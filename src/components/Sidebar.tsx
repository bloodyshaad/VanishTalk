import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, Users, UserPlus, Settings, LogOut, Search, Plus, Check, X, Users2, Shield, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isUserOnline, formatLastSeen } from '../lib/presence'
import { AvatarUpload } from './AvatarUpload'

type Tab = 'chats' | 'friends' | 'requests'

interface Profile {
    id: string
    username: string
    display_name: string
    bio?: string
    last_seen?: string
    avatar_url?: string
}

interface Chat {
    id: string
    name: string | null
    type: 'direct' | 'group'
    friendName?: string
    friendAvatar?: string
}

interface FriendRequest {
    id: string
    sender_id: string
    profiles: Profile
}

export const Sidebar = ({
    user,
    onLogout,
    onSelectFriend,
    onSelectChat
}: {
    user: any,
    onLogout: () => void,
    onSelectFriend: (friend: Profile) => void,
    onSelectChat: (chat: Chat, name: string) => void
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('chats')
    const [username, setUsername] = useState<string>('')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Profile[]>([])
    const [requests, setRequests] = useState<FriendRequest[]>([])
    const [friends, setFriends] = useState<Profile[]>([])
    const [chats, setChats] = useState<Chat[]>([])
    const [pendingSentRequests, setPendingSentRequests] = useState<string[]>([])

    const [showSettings, setShowSettings] = useState(false)
    const [displayName, setDisplayName] = useState('')
    const [bio, setBio] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [updating, setUpdating] = useState(false)

    const [showGroupModal, setShowGroupModal] = useState(false)
    const [groupName, setGroupName] = useState('')
    const [selectedFriends, setSelectedFriends] = useState<string[]>([])

    const fetchChats = useCallback(async () => {
        const { data: membershipData } = await supabase
            .from('chat_members')
            .select('chat_id')
            .eq('user_id', user.id)

        if (membershipData && membershipData.length > 0) {
            const chatIds = membershipData.map(m => m.chat_id)
            const { data: chatsData } = await supabase
                .from('chats')
                .select(`*, members:chat_members(user_id, profiles:user_id(username, display_name, avatar_url))`)
                .in('id', chatIds)
                .order('created_at', { ascending: false })

            if (chatsData) {
                const processed = chatsData.map((chat: any) => {
                    if (chat.type === 'direct') {
                        const otherMember = chat.members?.find((m: any) => m.user_id !== user.id)
                        const name = otherMember?.profiles?.display_name || otherMember?.profiles?.username || 'Unknown'
                        const avatar = otherMember?.profiles?.avatar_url || null
                        return { ...chat, friendName: name, friendAvatar: avatar }
                    }
                    return chat
                })
                setChats(processed)
            }
        } else {
            setChats([])
        }
    }, [user.id])

    const fetchRequests = useCallback(async () => {
        const { data } = await supabase
            .from('friend_requests')
            .select('id, sender_id, profiles:sender_id(id, username, display_name)')
            .eq('receiver_id', user.id)
            .eq('status', 'pending')

        if (data) setRequests(data as any[])
    }, [user.id])

    const fetchFriends = useCallback(async () => {
        const { data } = await supabase
            .from('friendships')
            .select('friend_id, profiles:friend_id(id, username, display_name, last_seen, avatar_url)')
            .eq('user_id', user.id)

        if (data) {
            setFriends(data.map((f: any) => f.profiles).filter(Boolean))
        }
    }, [user.id])

    const fetchPendingSentRequests = useCallback(async () => {
        const { data } = await supabase
            .from('friend_requests')
            .select('receiver_id')
            .eq('sender_id', user.id)
            .eq('status', 'pending')

        if (data) {
            setPendingSentRequests(data.map(r => r.receiver_id))
        }
    }, [user.id])

    useEffect(() => {
        const fetchProfile = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('username, display_name, bio, avatar_url')
                .eq('id', user.id)
                .single()

            if (data) {
                setUsername(data.username || '')
                setDisplayName(data.display_name || '')
                setBio(data.bio || '')
                setAvatarUrl(data.avatar_url || null)
            }
        }

        fetchProfile()
        fetchRequests()
        fetchFriends()
        fetchChats()
        fetchPendingSentRequests()

        // Realtime subscriptions
        const requestsChannel = supabase
            .channel('friend_requests_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friend_requests',
                filter: `receiver_id=eq.${user.id}`
            }, () => {
                fetchRequests()
                fetchFriends()
            })
            .subscribe()

        const friendshipsChannel = supabase
            .channel('friendships_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchFriends()
            })
            .subscribe()

        const chatsChannel = supabase
            .channel('chat_members_changes')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_members',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchChats()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(requestsChannel)
            supabase.removeChannel(friendshipsChannel)
            supabase.removeChannel(chatsChannel)
        }
    }, [user.id, fetchRequests, fetchFriends, fetchChats, fetchPendingSentRequests])

    const [isSearching, setIsSearching] = useState(false)

    // Auto-search as user types with debounce
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        const timeoutId = setTimeout(async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, display_name, avatar_url')
                .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
                .neq('id', user.id)
                .limit(10)

            if (data && !error) {
                // Filter out existing friends and pending requests
                const friendIds = friends.map(f => f.id)
                const filtered = data.filter(p =>
                    !friendIds.includes(p.id) &&
                    !pendingSentRequests.includes(p.id)
                )
                setSearchResults(filtered)
            } else {
                setSearchResults([])
            }
            setIsSearching(false)
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [searchQuery, user.id, friends, pendingSentRequests])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        // Search is now automatic, this just prevents form submission
    }

    const sendRequest = async (receiverId: string) => {
        const { error } = await supabase.from('friend_requests').insert({
            sender_id: user.id,
            receiver_id: receiverId
        })

        if (!error) {
            setSearchResults(prev => prev.filter(p => p.id !== receiverId))
            setPendingSentRequests(prev => [...prev, receiverId])
        }
    }

    const respondToRequest = async (requestId: string, _senderId: string, status: 'accepted' | 'declined') => {
        await supabase.from('friend_requests').update({ status }).eq('id', requestId)

        setRequests(prev => prev.filter(r => r.id !== requestId))

        if (status === 'accepted') {
            // Refresh friends list after accepting
            setTimeout(() => fetchFriends(), 500)
        }
    }

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedFriends.length === 0) return

        const { data: newChat } = await supabase
            .from('chats')
            .insert({ name: groupName, type: 'group' })
            .select()
            .single()

        if (newChat) {
            const members = [
                { chat_id: newChat.id, user_id: user.id, role: 'admin' },
                ...selectedFriends.map(id => ({ chat_id: newChat.id, user_id: id, role: 'member' }))
            ]
            await supabase.from('chat_members').insert(members)

            setShowGroupModal(false)
            setGroupName('')
            setSelectedFriends([])

            // Refresh chats and select the new one
            await fetchChats()
            onSelectChat(newChat as Chat, groupName)
        }
    }

    const toggleFriendSelection = (id: string) => {
        setSelectedFriends(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
    }

    const handleUpdateProfile = async () => {
        setUpdating(true)
        const { error } = await supabase.from('profiles').update({
            display_name: displayName,
            bio
        }).eq('id', user.id)

        setUpdating(false)
        if (!error) {
            setShowSettings(false)
        }
    }

    const handleRefresh = () => {
        fetchChats()
        fetchFriends()
        fetchRequests()
    }

    const activeName = displayName || username || 'User'

    return (
        <aside className="sidebar-monolith">
            <header className="monolith-header">
                <div>
                    <h1 className="t-brand">Vanish.</h1>
                    <p className="t-meta mt-1 opacity-40">Vault Control</p>
                </div>
                <div className="flex space-x-1">
                    <button onClick={handleRefresh} className="p-2 text-v-40 hover:text-white" title="Refresh">
                        <RefreshCw size={14} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => setShowSettings(true)} className="p-2 text-v-40 hover:text-white">
                        <Settings size={16} strokeWidth={1.5} />
                    </button>
                    <button onClick={onLogout} className="p-2 text-v-40 hover:text-white">
                        <LogOut size={16} strokeWidth={1.5} />
                    </button>
                </div>
            </header>

            <nav className="monolith-tabs">
                {[
                    { id: 'chats', Icon: MessageSquare, Label: 'CHATS' },
                    { id: 'friends', Icon: Users, Label: 'FRIENDS' },
                    { id: 'requests', Icon: UserPlus, Label: 'REQUESTS', count: requests.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`tab-node ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        <tab.Icon size={14} strokeWidth={activeTab === tab.id ? 2 : 1.5} />
                        <span>{tab.Label}{tab.count ? ` (${tab.count})` : ''}</span>
                    </button>
                ))}
            </nav>

            <div className="monolith-scroll scrollbar-hide">
                {activeTab === 'chats' && (
                    <div className="space-y-6 animate-entrance">
                        <div className="flex items-center justify-between">
                            <h2 className="t-heading">Conversations</h2>
                            <button onClick={() => setShowGroupModal(true)} className="p-2 border hover:border-white text-v-40 hover:text-white" title="Create Group">
                                <Plus size={12} strokeWidth={2} />
                            </button>
                        </div>
                        {chats.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="t-meta opacity-40">No conversations yet</p>
                                <p className="t-meta opacity-20 mt-2">Start chatting with a friend!</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {chats.map(chat => (
                                    <div
                                        key={chat.id}
                                        onClick={() => onSelectChat(chat, chat.friendName || chat.name || 'Chat')}
                                        className="flex items-center space-x-3 p-3 bg-v-05 border hover:border-white cursor-pointer transition-colors"
                                    >
                                        <div className="w-8 h-8 border flex items-center justify-center text-[10px] font-bold bg-black flex-shrink-0">
                                            {chat.type === 'group' ? (
                                                <Users2 size={14} strokeWidth={1.5} />
                                            ) : chat.friendAvatar ? (
                                                <img src={chat.friendAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                (chat.friendName?.[0] || 'U').toUpperCase()
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold tracking-wide text-white truncate">{chat.friendName || chat.name}</p>
                                            <p className="t-meta opacity-40">{chat.type === 'group' ? 'Group Chat' : 'Direct Message'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'friends' && (
                    <div className="space-y-6 animate-entrance">
                        <div className="space-y-3">
                            <h2 className="t-heading">Find Users</h2>
                            <form onSubmit={handleSearch} className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by username..."
                                    className="clinical-input pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-v-40" />
                            </form>
                        </div>

                        {searchQuery && searchResults.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="t-heading">Search Results</h2>
                                <div className="space-y-2">
                                    {searchResults.map(result => (
                                        <div key={result.id} className="flex items-center justify-between p-3 bg-v-05 border">
                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                <div className="w-8 h-8 border bg-black flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ overflow: 'hidden' }}>
                                                    {result.avatar_url ? (
                                                        <img src={result.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        (result.display_name || result.username)[0].toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold tracking-wide text-white truncate">{result.display_name || result.username}</p>
                                                    <p className="t-meta opacity-40">@{result.username}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => sendRequest(result.id)} className="p-2 border hover:bg-white hover:text-black ml-2" title="Send Friend Request">
                                                <Plus size={12} strokeWidth={2} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {searchQuery && isSearching && (
                            <p className="t-meta opacity-40 text-center py-4">Searching...</p>
                        )}

                        {searchQuery && !isSearching && searchResults.length === 0 && (
                            <p className="t-meta opacity-40 text-center py-4">No users found</p>
                        )}

                        <div className="space-y-3">
                            <h2 className="t-heading">Your Friends ({friends.length})</h2>
                            {friends.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="t-meta opacity-40">No friends yet</p>
                                    <p className="t-meta opacity-20 mt-2">Search for users above!</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {friends.map(friend => {
                                        const online = isUserOnline(friend.last_seen || null)
                                        return (
                                            <div
                                                key={friend.id}
                                                onClick={() => {
                                                    console.log('Friend clicked:', friend)
                                                    onSelectFriend(friend)
                                                }}
                                                className="flex items-center space-x-3 p-3 bg-v-05 border hover:border-white cursor-pointer transition-colors"
                                            >
                                                <div className="relative">
                                                    <div className="w-8 h-8 border bg-black flex items-center justify-center text-[10px] font-bold" style={{ overflow: 'hidden' }}>
                                                        {friend.avatar_url ? (
                                                            <img src={friend.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            (friend.display_name || friend.username)[0].toUpperCase()
                                                        )}
                                                    </div>
                                                    {/* Online indicator */}
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-black rounded-full ${online ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold tracking-wide text-white truncate">{friend.display_name || friend.username}</p>
                                                    <p className={`t-meta ${online ? 'text-green-400' : 'opacity-40'}`}>
                                                        {formatLastSeen(friend.last_seen || null)}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="space-y-6 animate-entrance">
                        <h2 className="t-heading">Friend Requests ({requests.length})</h2>
                        {requests.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="t-meta opacity-40">No pending requests</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {requests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-3 bg-v-05 border">
                                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                                            <div className="w-8 h-8 border bg-black flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                                {(req.profiles.display_name || req.profiles.username)[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold tracking-wide text-white truncate">{req.profiles.display_name || req.profiles.username}</p>
                                                <p className="t-meta opacity-40">@{req.profiles.username}</p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2 ml-2">
                                            <button
                                                onClick={() => respondToRequest(req.id, req.sender_id, 'accepted')}
                                                className="p-2 border border-green-500/50 text-green-500 hover:bg-green-500 hover:text-black"
                                                title="Accept"
                                            >
                                                <Check size={12} strokeWidth={2} />
                                            </button>
                                            <button
                                                onClick={() => respondToRequest(req.id, req.sender_id, 'declined')}
                                                className="p-2 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black"
                                                title="Decline"
                                            >
                                                <X size={12} strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <footer className="monolith-footer">
                <div className="flex items-center space-x-3 w-full overflow-hidden">
                    <div className="w-9 h-9 border bg-black flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ overflow: 'hidden' }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            activeName[0]?.toUpperCase() || 'U'
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold tracking-wide text-white truncate">{activeName}</p>
                        <div className="flex items-center space-x-2 mt-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <p className="t-meta opacity-60">Online</p>
                        </div>
                    </div>
                    <Shield size={16} className="text-v-40 flex-shrink-0" strokeWidth={1.5} />
                </div>
            </footer>

            {showGroupModal && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="w-full max-w-sm bg-black border p-6 space-y-6 animate-entrance">
                        <div className="flex justify-between items-center">
                            <h2 className="t-brand">Create Group</h2>
                            <button onClick={() => setShowGroupModal(false)} className="text-v-40 hover:text-white">
                                <X size={20} strokeWidth={1.5} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="t-meta mb-2">Group Name</p>
                                <input placeholder="Enter group name..." className="clinical-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                            </div>
                            <div>
                                <p className="t-meta mb-2">Select Members ({selectedFriends.length} selected)</p>
                                <div className="max-h-48 overflow-y-auto space-y-2 border p-2">
                                    {friends.length === 0 ? (
                                        <p className="t-meta opacity-40 text-center py-4">Add friends first!</p>
                                    ) : (
                                        friends.map(friend => (
                                            <div
                                                key={friend.id}
                                                onClick={() => toggleFriendSelection(friend.id)}
                                                className={`p-3 border cursor-pointer flex justify-between text-[11px] font-bold transition-colors ${selectedFriends.includes(friend.id) ? 'bg-white text-black border-white' : 'text-v-40 hover:border-white'}`}
                                            >
                                                <span>{friend.display_name || friend.username}</span>
                                                {selectedFriends.includes(friend.id) && <Check size={14} strokeWidth={2} />}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedFriends.length === 0}
                                className="btn-monolith"
                                style={{ opacity: (!groupName.trim() || selectedFriends.length === 0) ? 0.5 : 1 }}
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showSettings && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="w-full max-w-sm bg-black border p-6 space-y-6 animate-entrance">
                        <div className="flex justify-between items-center">
                            <h2 className="t-brand">Profile</h2>
                            <button onClick={() => setShowSettings(false)} className="text-v-40 hover:text-white">
                                <X size={20} strokeWidth={1.5} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {/* Avatar Upload */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                <p className="t-meta">Profile Picture</p>
                                <AvatarUpload
                                    userId={user.id}
                                    currentAvatar={avatarUrl}
                                    onAvatarChange={(url) => setAvatarUrl(url)}
                                    size="lg"
                                />
                                <p style={{ fontSize: '10px', color: 'var(--v-40)' }}>Hover and click to upload</p>
                            </div>
                            <div>
                                <p className="t-meta mb-2">Username (cannot change)</p>
                                <input disabled value={username} className="clinical-input opacity-40" />
                            </div>
                            <div>
                                <p className="t-meta mb-2">Display Name</p>
                                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="clinical-input" placeholder="Your display name..." />
                            </div>
                            <div>
                                <p className="t-meta mb-2">Bio</p>
                                <textarea className="clinical-input" style={{ minHeight: '80px', resize: 'none' }} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." />
                            </div>
                            <button onClick={handleUpdateProfile} disabled={updating} className="btn-monolith">
                                {updating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </aside>
    )
}
