import { BrowserRouter as Router, useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { startPresenceTracking, stopPresenceTracking, requestNotificationPermission } from './lib/presence'

import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'

import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'

interface Profile {
  id: string
  username: string
  display_name: string
}

const ChatLayout = ({ user, onLogout }: { user: any, onLogout: () => void }) => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'direct' | 'group'>('direct')
  const [selectedFriendId, setSelectedFriendId] = useState<string | undefined>(undefined)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  // Detect mobile and handle resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(true) // Always show sidebar on desktop
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSelectChat = useCallback((chat: any, name: string, avatar?: string | null) => {
    console.log('Selecting chat:', chat, name)
    setSelectedChatId(chat.id || chat)
    setSelectedName(name)
    setSelectedAvatar(avatar || chat.friendAvatar || null)
    setSelectedType(chat.type || 'direct')
    // For direct chats, extract friend ID from members
    if (chat.type === 'direct' && chat.members) {
      const friendMember = chat.members.find((m: any) => m.user_id !== user.id)
      setSelectedFriendId(friendMember?.user_id)
    } else {
      setSelectedFriendId(undefined)
    }
    // Hide sidebar on mobile after selecting chat
    if (isMobile) setSidebarOpen(false)
  }, [user.id, isMobile])

  const handleSelectFriend = useCallback(async (friend: Profile) => {
    console.log('Friend selected:', friend)
    const friendName = friend.display_name || friend.username

    try {
      // Step 1: Get all direct chats the current user is in
      const { data: userMemberships, error: userError } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id)

      console.log('User memberships:', userMemberships, userError)

      if (!userMemberships || userMemberships.length === 0) {
        // User has no chats, create a new one
        console.log('No chats found, creating new one')
        await createNewChat(friend.id, friendName)
        return
      }

      // Step 2: Find chats where the friend is also a member
      const userChatIds = userMemberships.map(m => m.chat_id)
      const { data: friendMemberships, error: friendError } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', friend.id)
        .in('chat_id', userChatIds)

      console.log('Friend memberships:', friendMemberships, friendError)

      if (!friendMemberships || friendMemberships.length === 0) {
        // No common chat with this friend
        console.log('No common chats, creating new one')
        await createNewChat(friend.id, friendName)
        return
      }

      // Step 3: Check if any of these common chats is a direct chat
      const commonChatIds = friendMemberships.map(m => m.chat_id)
      const { data: directChats, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('type', 'direct')
        .in('id', commonChatIds)
        .limit(1)

      console.log('Direct chats found:', directChats, chatError)

      if (directChats && directChats.length > 0) {
        // Found an existing direct chat
        console.log('Opening existing chat:', directChats[0].id)
        handleSelectChat(directChats[0].id, friendName)
      } else {
        // No direct chat exists, create one
        console.log('No direct chat found, creating new one')
        await createNewChat(friend.id, friendName)
      }
    } catch (error) {
      console.error('Error in handleSelectFriend:', error)
      // Fallback: create new chat
      await createNewChat(friend.id, friendName)
    }

    async function createNewChat(friendId: string, name: string) {
      console.log('Creating new chat with:', friendId)

      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({ type: 'direct' })
        .select('id')
        .single()

      if (chatError || !newChat) {
        console.error('Error creating chat:', chatError)
        return
      }

      console.log('Created chat:', newChat)

      // Add both users as members
      const { error: membersError } = await supabase
        .from('chat_members')
        .insert([
          { chat_id: newChat.id, user_id: user.id },
          { chat_id: newChat.id, user_id: friendId }
        ])

      if (membersError) {
        console.error('Error adding members:', membersError)
        return
      }

      console.log('Members added, selecting chat')
      handleSelectChat(newChat, name)
    }
  }, [user.id, handleSelectChat])

  const handleChatFromSidebar = useCallback((chat: any, name: string) => {
    console.log('Chat from sidebar:', chat, name)
    handleSelectChat(chat, name)
  }, [handleSelectChat])

  return (
    <div className="app-shell">
      {/* Mobile Menu Button */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="mobile-menu-btn"
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Sidebar - with conditional class for mobile hiding */}
      <div className={`sidebar-monolith ${isMobile && !sidebarOpen ? 'sidebar-hidden' : ''}`}>
        <Sidebar
          user={user}
          onLogout={onLogout}
          onSelectFriend={handleSelectFriend}
          onSelectChat={handleChatFromSidebar}
        />
      </div>

      <main className="viewport-main">
        {selectedChatId ? (
          <ChatWindow
            key={selectedChatId}
            chatId={selectedChatId}
            user={user}
            friendName={selectedName}
            friendAvatar={selectedAvatar}
            chatType={selectedType}
            friendId={selectedFriendId}
            onBack={isMobile ? () => setSidebarOpen(true) : undefined}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center animate-entrance">
            <div className="text-center space-y-4">
              <h1 className="t-brand-large">VANISH.</h1>
              <p className="t-meta opacity-20">
                {isMobile ? 'Tap menu to select a conversation' : 'Select a conversation to start messaging'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)

      // Start presence tracking and request notifications
      if (session) {
        startPresenceTracking()
        requestNotificationPermission()
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        startPresenceTracking()
        requestNotificationPermission()
      } else {
        stopPresenceTracking()
        navigate('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
      stopPresenceTracking()
    }
  }, [navigate])

  const handleLogout = async () => {
    stopPresenceTracking()
    await supabase.auth.signOut()
    setSession(null)
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center bg-black">
        <div className="text-center space-y-6 animate-entrance">
          <div className="w-16 h-16 border-2 border-white mx-auto flex items-center justify-center">
            <div className="w-4 h-4 bg-white animate-pulse"></div>
          </div>
          <p className="t-meta opacity-40">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={session ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/login"
        element={session ? <Navigate to="/chat" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={session ? <Navigate to="/chat" replace /> : <SignupPage />}
      />
      <Route
        path="/chat/*"
        element={session ? <ChatLayout user={session.user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

const AppWrapper = () => (
  <Router>
    <App />
  </Router>
)

export default AppWrapper
