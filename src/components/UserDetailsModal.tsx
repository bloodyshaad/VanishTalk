import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { X, Shield, Loader2, Crown, Users, UserMinus, LogOut, Trash2, Maximize2 } from 'lucide-react'
import { formatLastSeen, isUserOnline } from '../lib/presence'

interface UserProfile {
    id: string
    username: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    last_seen: string | null
}

interface ChatMember {
    user_id: string
    role: 'admin' | 'member'
    profiles: UserProfile
}

interface ChatInfo {
    id: string
    name: string | null
    type: 'direct' | 'group'
    created_by: string | null
    created_at: string
}

interface UserDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    chatId: string
    chatType: 'direct' | 'group'
    userId: string // Current user id
    friendId?: string // For direct chats
    onGroupDeleted?: () => void // Callback when group is deleted
    onLeftGroup?: () => void // Callback when user leaves group
}

export const UserDetailsModal = ({ isOpen, onClose, chatId, chatType, userId, friendId, onGroupDeleted, onLeftGroup }: UserDetailsModalProps) => {
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null)
    const [members, setMembers] = useState<ChatMember[]>([])
    const [directUser, setDirectUser] = useState<UserProfile | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
        fetchData()
    }, [isOpen, chatId])

    const fetchData = async () => {
        setLoading(true)

        // Fetch chat info
        const { data: chat } = await supabase
            .from('chats')
            .select('id, name, type, created_by, created_at')
            .eq('id', chatId)
            .single()

        if (chat) {
            setChatInfo(chat)
        }

        if (chatType === 'direct' && friendId) {
            // Fetch friend's profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, username, display_name, bio, avatar_url, last_seen')
                .eq('id', friendId)
                .single()

            if (profile) {
                setDirectUser(profile)
            }
        } else {
            // Fetch all members for group
            const { data: memberData } = await supabase
                .from('chat_members')
                .select('user_id, role, profiles:user_id(id, username, display_name, bio, avatar_url, last_seen)')
                .eq('chat_id', chatId)

            if (memberData) {
                setMembers(memberData as any)
            }
        }

        setLoading(false)
    }

    const removeMember = async (memberId: string) => {
        if (!isAdmin || memberId === userId) return

        setActionLoading(memberId)
        const { error } = await supabase
            .from('chat_members')
            .delete()
            .eq('chat_id', chatId)
            .eq('user_id', memberId)

        if (!error) {
            setMembers(prev => prev.filter(m => m.user_id !== memberId))
        }
        setActionLoading(null)
    }

    const leaveGroup = async () => {
        setActionLoading('leave')
        const { error } = await supabase
            .from('chat_members')
            .delete()
            .eq('chat_id', chatId)
            .eq('user_id', userId)

        if (!error) {
            onClose()
            onLeftGroup?.()
        }
        setActionLoading(null)
    }

    const deleteGroup = async () => {
        // Check admin directly (not via isAdmin variable which may be stale
        if (chatInfo?.created_by !== userId) {
            console.error('Not admin, cannot delete')
            return
        }

        setActionLoading('delete')
        console.log('Deleting group:', chatId)

        try {
            // First get all message IDs for this chat
            const { data: chatMessages } = await supabase
                .from('messages')
                .select('id')
                .eq('chat_id', chatId)

            // Delete reactions for those messages (if any)
            if (chatMessages && chatMessages.length > 0) {
                const messageIds = chatMessages.map(m => m.id)
                await supabase
                    .from('message_reactions')
                    .delete()
                    .in('message_id', messageIds)
            }

            // Delete all messages
            const { error: msgError } = await supabase
                .from('messages')
                .delete()
                .eq('chat_id', chatId)
            if (msgError) console.error('Messages delete error:', msgError)

            // Delete all members
            const { error: memberError } = await supabase
                .from('chat_members')
                .delete()
                .eq('chat_id', chatId)
            if (memberError) console.error('Members delete error:', memberError)

            // Delete the chat
            const { error: chatError } = await supabase
                .from('chats')
                .delete()
                .eq('id', chatId)

            if (chatError) {
                console.error('Chat delete error:', chatError)
            } else {
                console.log('Group deleted successfully')
                onClose()
                onGroupDeleted?.()
            }
        } catch (err) {
            console.error('Unexpected error:', err)
        }

        setActionLoading(null)
    }

    if (!isOpen) return null

    const isAdmin = chatInfo?.created_by === userId

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div className="w-full max-w-md bg-black border p-6 animate-entrance" style={{ maxHeight: '80vh', overflow: 'auto' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="t-brand">
                        {chatType === 'direct' ? 'User Details' : 'Group Members'}
                    </h2>
                    <button onClick={onClose} className="text-v-40 hover:text-white">
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-white/40" size={24} />
                    </div>
                ) : chatType === 'direct' && directUser ? (
                    // Direct Chat - Show single user
                    <div className="space-y-6">
                        {/* Avatar */}
                        <div className="flex flex-col items-center space-y-4">
                            <div
                                onClick={() => directUser.avatar_url && setFullscreenImage(directUser.avatar_url)}
                                style={{
                                    width: 96,
                                    height: 96,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: '#000',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 32,
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    cursor: directUser.avatar_url ? 'pointer' : 'default'
                                }}
                            >
                                {directUser.avatar_url ? (
                                    <>
                                        <img src={directUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(0,0,0,0.5)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: 0,
                                            transition: 'opacity 0.2s'
                                        }} className="hover-overlay">
                                            <Maximize2 size={24} color="white" />
                                        </div>
                                        <style>{`.hover-overlay:hover { opacity: 1 !important; }`}</style>
                                    </>
                                ) : (
                                    (directUser.display_name || directUser.username)[0].toUpperCase()
                                )}
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">{directUser.display_name || directUser.username}</h3>
                                <p className="text-v-40 text-sm">@{directUser.username}</p>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-center space-x-2">
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: isUserOnline(directUser.last_seen) ? '#22c55e' : '#6b7280'
                            }} />
                            <span className={`text-sm ${isUserOnline(directUser.last_seen) ? 'text-green-400' : 'text-v-40'}`}>
                                {formatLastSeen(directUser.last_seen)}
                            </span>
                        </div>

                        {/* Bio */}
                        {directUser.bio && (
                            <div className="p-4 bg-v-05 border border-white/10">
                                <p className="t-meta text-v-40 mb-2">Bio</p>
                                <p className="text-sm text-white/80 leading-relaxed">{directUser.bio}</p>
                            </div>
                        )}

                        {/* Secure badge */}
                        <div className="flex items-center justify-center space-x-2 text-v-40 text-sm">
                            <Shield size={14} />
                            <span>End-to-end encrypted</span>
                        </div>
                    </div>
                ) : (
                    // Group - Show all members
                    <div className="space-y-4">
                        {/* Group info */}
                        <div className="p-4 bg-v-05 border border-white/10">
                            <div className="flex items-center space-x-3">
                                <Users size={20} className="text-v-40" />
                                <div>
                                    <p className="font-bold text-white">{chatInfo?.name || 'Group Chat'}</p>
                                    <p className="text-sm text-v-40">{members.length} members</p>
                                </div>
                            </div>
                        </div>

                        {/* Members list */}
                        <div className="space-y-2">
                            <p className="t-meta text-v-40">Members</p>
                            {members.map((member) => {
                                const profile = member.profiles
                                const isMemberAdmin = member.role === 'admin' || member.user_id === chatInfo?.created_by
                                const online = isUserOnline(profile.last_seen)
                                const isCurrentUser = member.user_id === userId

                                return (
                                    <div key={member.user_id} className="flex items-center justify-between p-3 bg-v-05 border border-white/10">
                                        <div className="flex items-center space-x-3">
                                            <div className="relative">
                                                <div style={{
                                                    width: 40,
                                                    height: 40,
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    background: '#000',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 14,
                                                    fontWeight: 'bold',
                                                    overflow: 'hidden'
                                                }}>
                                                    {profile.avatar_url ? (
                                                        <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        (profile.display_name || profile.username)[0].toUpperCase()
                                                    )}
                                                </div>
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: -2,
                                                    right: -2,
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    border: '2px solid #000',
                                                    background: online ? '#22c55e' : '#6b7280'
                                                }} />
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <p className="font-semibold text-white text-sm">
                                                        {profile.display_name || profile.username}
                                                        {isCurrentUser && ' (You)'}
                                                    </p>
                                                    {isMemberAdmin && (
                                                        <span className="flex items-center space-x-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase">
                                                            <Crown size={10} />
                                                            <span>Admin</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-v-40 text-xs">@{profile.username}</p>
                                            </div>
                                        </div>

                                        {/* Remove member button (admin only, can't remove self) */}
                                        {isAdmin && !isCurrentUser && (
                                            <button
                                                onClick={() => removeMember(member.user_id)}
                                                disabled={actionLoading === member.user_id}
                                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                                title="Remove from group"
                                            >
                                                {actionLoading === member.user_id ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <UserMinus size={16} />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Group Actions */}
                        <div className="pt-4 space-y-3 border-t border-white/10">
                            {/* Leave Group - available to everyone except admin */}
                            {!isAdmin && (
                                <button
                                    onClick={leaveGroup}
                                    disabled={actionLoading === 'leave'}
                                    className="w-full flex items-center justify-center space-x-2 p-3 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors"
                                >
                                    {actionLoading === 'leave' ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <LogOut size={16} />
                                    )}
                                    <span className="font-semibold text-sm">Leave Group</span>
                                </button>
                            )}

                            {/* Delete Group - admin only */}
                            {isAdmin && (
                                <>
                                    {!confirmDelete ? (
                                        <button
                                            onClick={() => setConfirmDelete(true)}
                                            className="w-full flex items-center justify-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                            <span className="font-semibold text-sm">Delete Group</span>
                                        </button>
                                    ) : (
                                        <div className="p-4 bg-red-500/10 border border-red-500/30 space-y-3">
                                            <p className="text-sm text-red-300 text-center">
                                                Are you sure? This will permanently delete the group and all messages.
                                            </p>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => setConfirmDelete(false)}
                                                    className="flex-1 p-2 bg-v-10 border border-white/10 text-white text-sm hover:bg-v-15"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={deleteGroup}
                                                    disabled={actionLoading === 'delete'}
                                                    className="flex-1 p-2 bg-red-500 text-white text-sm font-bold hover:bg-red-600"
                                                >
                                                    {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Admin notice */}
                        {!isAdmin && (
                            <div className="p-4 bg-v-05 border border-white/10">
                                <p className="text-sm text-v-40">
                                    Only the group admin can remove members and delete the group.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Fullscreen Image Lightbox */}
            {fullscreenImage && (
                <div
                    onClick={() => setFullscreenImage(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.98)',
                        zIndex: 100000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'zoom-out',
                        padding: '2rem'
                    }}
                >
                    <button
                        onClick={() => setFullscreenImage(null)}
                        style={{
                            position: 'absolute',
                            top: 20,
                            right: 20,
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: 12,
                            cursor: 'pointer'
                        }}
                    >
                        <X size={24} color="white" />
                    </button>
                    <img
                        src={fullscreenImage}
                        alt="Profile"
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            objectFit: 'contain',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>,
        document.body
    )
}
