import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { sendNotification } from '../lib/presence'
import { Send, Clock, ShieldCheck, Trash2, Settings, X, CornerUpRight, Pencil, Users } from 'lucide-react'
import { format } from 'date-fns'
import { PremiumDropdown } from './PremiumDropdown'
import { EmojiReactions } from './EmojiReactions'
import { ReplyPreview, QuotedMessage } from './ReplyPreview'
import { UserDetailsModal } from './UserDetailsModal'
import { VoiceRecorder } from './VoiceRecorder'
import { FileUploader } from './FileUploader'
import { AudioPlayer } from './AudioPlayer'

interface Message {
    id: string
    content: string
    sender_id: string
    created_at: string
    vanish_at: string | null
    reply_to: string | null
    edited_at: string | null
    original_content: string | null
    audio_url?: string | null
    audio_duration?: number | null
    file_url?: string | null
    file_type?: string | null
    file_name?: string | null
}

interface TypingUser {
    id: string
    username: string
}

interface ChatSettings {
    default_vanish_hours: number | null
}

const VANISH_OPTIONS = [
    { value: '', label: 'Permanent' },
    { value: '1', label: '1 Min' },
    { value: '5', label: '5 Min' },
    { value: '30', label: '30 Min' },
    { value: '60', label: '1 Hour' },
    { value: '360', label: '6 Hours' },
    { value: '720', label: '12 Hours' },
    { value: '1440', label: '24 Hours' },
]

const CHAT_VISIBILITY_OPTIONS = [
    { value: '', label: 'Permanent' },
    { value: '1', label: '1 Hour' },
    { value: '6', label: '6 Hours' },
    { value: '12', label: '12 Hours' },
    { value: '24', label: '24 Hours' },
    { value: '48', label: '2 Days' },
    { value: '168', label: '1 Week' },
]

export const ChatWindow = ({ chatId, user, friendName, friendAvatar, chatType = 'direct', friendId, onBack }: {
    chatId: string,
    user: any,
    friendName: string,
    friendAvatar?: string | null,
    chatType?: 'direct' | 'group',
    friendId?: string,
    onBack?: () => void
}) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [vanishOption, setVanishOption] = useState<number | null>(null)
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
    const [isTyping, setIsTyping] = useState(false)
    const [sending, setSending] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [chatSettings, setChatSettings] = useState<ChatSettings>({ default_vanish_hours: null })
    const [settingsLoading, setSettingsLoading] = useState(false)

    // Phase 4 state - Admin controls
    const [isAdmin, setIsAdmin] = useState(false)
    const [showUserDetails, setShowUserDetails] = useState(false)

    // Phase 2 state
    const [replyTo, setReplyTo] = useState<Message | null>(null)
    const [editingMessage, setEditingMessage] = useState<Message | null>(null)
    const [editContent, setEditContent] = useState('')

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchChatSettings = useCallback(async () => {
        const { data } = await supabase
            .from('chats')
            .select('default_vanish_hours, created_by, type')
            .eq('id', chatId)
            .single()

        if (data) {
            setChatSettings({ default_vanish_hours: data.default_vanish_hours })
            if (data.default_vanish_hours) {
                setVanishOption(data.default_vanish_hours * 60)
            }
            // Check if current user is admin (direct chats always allow, group chats check created_by)
            setIsAdmin(data.type === 'direct' || data.created_by === user.id)
        }
    }, [chatId, user.id])

    const fetchMessages = useCallback(async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

        if (data && !error) {
            const now = new Date()
            const valid = data.filter(msg => !msg.vanish_at || new Date(msg.vanish_at) > now)
            setMessages(valid)
        }
    }, [chatId])

    useEffect(() => {
        fetchChatSettings()
        fetchMessages()

        const messagesChannel = supabase
            .channel(`messages:${chatId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            }, (payload) => {
                const newMsg = payload.new as Message
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev
                    return [...prev, newMsg]
                })

                if (newMsg.sender_id !== user.id) {
                    sendNotification(
                        `New message from ${friendName}`,
                        newMsg.content.slice(0, 50) + (newMsg.content.length > 50 ? '...' : '')
                    )
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            }, (payload) => {
                const updatedMsg = payload.new as Message
                setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m))
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            }, (payload) => {
                const deletedId = (payload.old as any).id
                if (deletedId) {
                    setMessages(prev => prev.filter(m => m.id !== deletedId))
                }
            })
            .subscribe()

        const presenceChannel = supabase.channel(`presence:${chatId}`)

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState()
                const typing = Object.values(state)
                    .flat()
                    .filter((p: any) => p.isTyping && p.user_id !== user.id)
                    .map((p: any) => ({ id: p.user_id, username: p.username }))
                setTypingUsers(typing as TypingUser[])
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        user_id: user.id,
                        username: user.email?.split('@')[0] || 'User',
                        isTyping: false
                    })
                }
            })

        return () => {
            supabase.removeChannel(messagesChannel)
            supabase.removeChannel(presenceChannel)
        }
    }, [chatId, user.id, user.email, friendName, fetchMessages, fetchChatSettings])

    useEffect(() => {
        const presenceChannel = supabase.channel(`presence:${chatId}`)
        presenceChannel.track({
            user_id: user.id,
            username: user.email?.split('@')[0] || 'User',
            isTyping
        })
    }, [isTyping, chatId, user.id, user.email])

    const handleTyping = (text: string) => {
        setNewMessage(text)

        if (text.length > 0) {
            if (!isTyping) setIsTyping(true)

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }

            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false)
            }, 2000)
        } else {
            setIsTyping(false)
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date()
            setMessages(prev => prev.filter(msg => {
                if (!msg.vanish_at) return true
                return new Date(msg.vanish_at) > now
            }))
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input when replying
    useEffect(() => {
        if (replyTo) {
            inputRef.current?.focus()
        }
    }, [replyTo])

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || sending) return

        setSending(true)
        setIsTyping(false)

        const vanishAt = vanishOption ? new Date(Date.now() + vanishOption * 60000).toISOString() : null

        const { error } = await supabase.from('messages').insert({
            chat_id: chatId,
            sender_id: user.id,
            content: newMessage.trim(),
            vanish_at: vanishAt,
            reply_to: replyTo?.id || null
        })

        if (!error) {
            setNewMessage('')
            setReplyTo(null)
        } else {
            console.error('Error sending message:', error)
        }
        setSending(false)
    }

    const deleteMessage = async (messageId: string) => {
        setDeleting(messageId)
        try {
            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId)
                .eq('sender_id', user.id)

            if (error) {
                console.error('Error deleting message:', error)
            } else {
                setMessages(prev => prev.filter(m => m.id !== messageId))
            }
        } catch (err) {
            console.error('Delete error:', err)
        }
        setDeleting(null)
    }

    const startEditing = (msg: Message) => {
        // Only allow editing within 15 minutes
        const msgTime = new Date(msg.created_at).getTime()
        const now = Date.now()
        if (now - msgTime > 15 * 60 * 1000) {
            return // Too late to edit
        }
        setEditingMessage(msg)
        setEditContent(msg.content)
    }

    const saveEdit = async () => {
        if (!editingMessage || !editContent.trim()) return

        const { error } = await supabase
            .from('messages')
            .update({
                content: editContent.trim(),
                edited_at: new Date().toISOString(),
                original_content: editingMessage.original_content || editingMessage.content
            })
            .eq('id', editingMessage.id)
            .eq('sender_id', user.id)

        if (!error) {
            setMessages(prev => prev.map(m =>
                m.id === editingMessage.id
                    ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() }
                    : m
            ))
        }
        setEditingMessage(null)
        setEditContent('')
    }

    const cancelEdit = () => {
        setEditingMessage(null)
        setEditContent('')
    }

    const saveChatSettings = async () => {
        setSettingsLoading(true)
        const { error } = await supabase
            .from('chats')
            .update({ default_vanish_hours: chatSettings.default_vanish_hours })
            .eq('id', chatId)

        if (!error) {
            if (chatSettings.default_vanish_hours) {
                setVanishOption(chatSettings.default_vanish_hours * 60)
            } else {
                setVanishOption(null)
            }
            setShowSettings(false)
        } else {
            console.error('Error saving settings:', error)
        }
        setSettingsLoading(false)
    }

    const getTimeRemaining = (vanishAt: string) => {
        const remaining = new Date(vanishAt).getTime() - Date.now()
        if (remaining <= 0) return 'Now'

        const hours = Math.floor(remaining / 3600000)
        const minutes = Math.floor((remaining % 3600000) / 60000)
        const seconds = Math.floor((remaining % 60000) / 1000)

        if (hours > 0) return `${hours}h ${minutes}m`
        if (minutes > 0) return `${minutes}m`
        return `${seconds}s`
    }

    const getReplyMessage = (replyId: string) => {
        return messages.find(m => m.id === replyId)
    }

    const canEdit = (msg: Message) => {
        const msgTime = new Date(msg.created_at).getTime()
        return Date.now() - msgTime <= 15 * 60 * 1000
    }

    const displayName = friendName || 'Chat'

    return (
        <div className="flex-1 flex flex-col bg-black animate-entrance overflow-hidden">
            {/* Header */}
            <div style={{ height: 'var(--header-h)' }} className="border-b flex items-center justify-between px-4 bg-v-05 flex-shrink-0">
                <div className="flex items-center space-x-3">
                    {/* Mobile Back Button */}
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="mobile-back-btn p-2 text-v-40 hover:text-white"
                            aria-label="Back to chats"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    <div className="w-9 h-9 border flex items-center justify-center text-[11px] font-bold bg-black" style={{ overflow: 'hidden' }}>
                        {friendAvatar ? (
                            <img src={friendAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            displayName[0]?.toUpperCase() || 'C'
                        )}
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-[13px] font-bold tracking-wide">{displayName}</h2>
                            <ShieldCheck size={12} className="opacity-30" strokeWidth={1.5} />
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                            {typingUsers.length > 0 ? (
                                <p className="t-meta text-green-400">typing...</p>
                            ) : (
                                <>
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                    <p className="t-meta opacity-40">Online</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    {isAdmin ? (
                        <div className="flex items-center space-x-3">
                            <Clock size={14} className="text-v-40" strokeWidth={1.5} />
                            <PremiumDropdown
                                options={VANISH_OPTIONS}
                                value={vanishOption?.toString() || null}
                                onChange={(val) => setVanishOption(val ? Number(val) : null)}
                                placeholder="Permanent"
                                compact
                            />
                        </div>
                    ) : vanishOption ? (
                        <div className="flex items-center space-x-2 text-v-40 text-xs">
                            <Clock size={12} strokeWidth={1.5} />
                            <span>Vanish: {vanishOption}min</span>
                        </div>
                    ) : null}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 text-v-40 hover:text-white border border-transparent hover:border-white/20 transition-all"
                        title="Chat Settings"
                    >
                        <Settings size={16} strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-hide">
                {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center h-full">
                        <div className="text-center">
                            <p className="t-meta opacity-40">No messages yet</p>
                            <p className="t-meta opacity-20 mt-2">Send the first message!</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.sender_id === user.id
                        const isDeleting = deleting === msg.id
                        const replyMsg = msg.reply_to ? getReplyMessage(msg.reply_to) : null

                        return (
                            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                                <div className={`max-w-[70%] space-y-1 ${isDeleting ? 'opacity-50' : ''}`}>
                                    {/* Quoted reply */}
                                    {replyMsg && (
                                        <QuotedMessage
                                            content={replyMsg.content}
                                            senderName={replyMsg.sender_id === user.id ? 'You' : friendName}
                                            isOwnMessage={isOwn}
                                        />
                                    )}

                                    <div className="flex items-end space-x-2">
                                        {/* Action buttons for own messages */}
                                        {isOwn && (
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {canEdit(msg) && (
                                                    <button
                                                        onClick={() => startEditing(msg)}
                                                        className="p-2 text-v-40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all"
                                                        title="Edit message"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteMessage(msg.id)}
                                                    disabled={isDeleting}
                                                    className="p-2 text-v-40 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                                                    title="Delete message"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        )}

                                        {/* Message bubble */}
                                        <div
                                            className={`px-4 py-3 text-[13px] leading-relaxed border ${isOwn ? 'bg-white text-black' : 'bg-v-05 text-white'}`}
                                            style={{ userSelect: 'text' }}
                                        >
                                            {/* Audio Message */}
                                            {msg.audio_url ? (
                                                <AudioPlayer src={msg.audio_url} duration={msg.audio_duration || undefined} />
                                            ) : msg.file_url ? (
                                                /* File Message */
                                                <a
                                                    href={msg.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`flex items-center gap-2 hover:underline ${isOwn ? 'text-black' : 'text-white'}`}
                                                >
                                                    <span>📎</span>
                                                    <span>{msg.file_name || 'Download file'}</span>
                                                </a>
                                            ) : (
                                                /* Text Message */
                                                msg.content
                                            )}
                                            {msg.edited_at && (
                                                <span className={`text-[9px] ml-2 ${isOwn ? 'text-black/40' : 'text-white/40'}`}>
                                                    (edited)
                                                </span>
                                            )}
                                        </div>

                                        {/* Reply button for others' messages */}
                                        {!isOwn && (
                                            <button
                                                onClick={() => setReplyTo(msg)}
                                                className="p-2 text-v-40 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                                title="Reply"
                                            >
                                                <CornerUpRight size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Message meta + reactions */}
                                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                        <div className={`flex items-center space-x-3 t-meta opacity-40`}>
                                            <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                                            {msg.vanish_at && (
                                                <span className="flex items-center space-x-1 text-orange-400">
                                                    <Clock size={10} />
                                                    <span>{getTimeRemaining(msg.vanish_at)}</span>
                                                </span>
                                            )}
                                        </div>
                                        <EmojiReactions
                                            messageId={msg.id}
                                            userId={user.id}
                                            isOwnMessage={isOwn}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}

                {typingUsers.length > 0 && (
                    <div className="flex justify-start pt-2">
                        <div className="flex items-center space-x-3 text-v-40">
                            <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <p className="t-meta text-green-400">
                                {typingUsers.map(u => u.username).join(', ')} typing...
                            </p>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (
                <ReplyPreview
                    replyTo={replyTo}
                    senderName={replyTo.sender_id === user.id ? 'yourself' : friendName}
                    onClear={() => setReplyTo(null)}
                />
            )}

            {/* Composer */}
            <div style={{ height: 'var(--footer-h)' }} className="px-4 flex items-center border-t bg-black flex-shrink-0">
                <div className="flex items-center gap-1 w-full">
                    {/* File Upload */}
                    <FileUploader
                        chatId={chatId}
                        userId={user.id}
                        onSent={fetchMessages}
                        vanishMinutes={vanishOption}
                    />
                    {/* Voice Recorder */}
                    <VoiceRecorder
                        chatId={chatId}
                        userId={user.id}
                        onSent={fetchMessages}
                        vanishMinutes={vanishOption}
                    />
                    {/* Text Input */}
                    <form onSubmit={sendMessage} className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={replyTo ? `Reply to ${replyTo.sender_id === user.id ? 'yourself' : friendName}...` : "Type a message..."}
                            className="clinical-input pr-12 py-3"
                            value={newMessage}
                            onChange={(e) => handleTyping(e.target.value)}
                            autoComplete="off"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-v-40 hover:text-white transition-colors disabled:opacity-30"
                        >
                            <Send size={18} strokeWidth={1.5} />
                        </button>
                    </form>
                </div>
            </div>

            {/* Edit Modal */}
            {editingMessage && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="w-full max-w-md bg-black border p-6 space-y-4 animate-entrance">
                        <div className="flex justify-between items-center">
                            <h2 className="t-brand">Edit Message</h2>
                            <button onClick={cancelEdit} className="text-v-40 hover:text-white">
                                <X size={20} strokeWidth={1.5} />
                            </button>
                        </div>

                        <input
                            type="text"
                            className="clinical-input"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            autoFocus
                        />

                        <div className="flex gap-3">
                            <button onClick={cancelEdit} className="flex-1 py-3 border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all text-[11px] font-bold uppercase tracking-wider">
                                Cancel
                            </button>
                            <button onClick={saveEdit} className="flex-1 btn-monolith">
                                Save
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Settings Modal */}
            {showSettings && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4rem 1rem', overflowY: 'auto' }}>
                    <div className="w-full max-w-sm bg-black border p-6 animate-entrance" style={{ overflow: 'visible' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="t-brand">Chat Settings</h2>
                            <button onClick={() => setShowSettings(false)} className="text-v-40 hover:text-white">
                                <X size={20} strokeWidth={1.5} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* View User Details Button */}
                            <button
                                onClick={() => {
                                    setShowSettings(false)
                                    setShowUserDetails(true)
                                }}
                                className="w-full flex items-center justify-between p-4 bg-v-05 border border-white/10 hover:border-white/30 transition-colors"
                            >
                                <div className="flex items-center space-x-3">
                                    <Users size={16} className="text-v-40" />
                                    <span className="text-sm font-semibold">
                                        {chatType === 'group' ? 'View Group Members' : 'View User Details'}
                                    </span>
                                </div>
                                <span className="text-v-40 text-xs">→</span>
                            </button>

                            {/* Vanish Settings - Admin Only */}
                            {isAdmin ? (
                                <>
                                    <div style={{ position: 'relative', zIndex: 10 }}>
                                        <p className="t-meta mb-3">Default Message Visibility</p>
                                        <p className="text-[11px] text-v-40 mb-4">Set how long messages should be visible by default in this conversation.</p>
                                        <PremiumDropdown
                                            options={CHAT_VISIBILITY_OPTIONS}
                                            value={chatSettings.default_vanish_hours?.toString() || null}
                                            onChange={(val) => setChatSettings({
                                                default_vanish_hours: val ? Number(val) : null
                                            })}
                                            placeholder="Permanent"
                                        />
                                    </div>

                                    <div className="p-4 bg-v-05 border border-white/10">
                                        <p className="t-meta text-orange-400 mb-2">⚠️ Note</p>
                                        <p className="text-[11px] text-v-40 leading-relaxed">
                                            This setting applies to new messages only. Existing messages will keep their original visibility settings.
                                        </p>
                                    </div>

                                    <button
                                        onClick={saveChatSettings}
                                        disabled={settingsLoading}
                                        className="btn-monolith"
                                    >
                                        {settingsLoading ? 'Saving...' : 'Save Settings'}
                                    </button>
                                </>
                            ) : (
                                <div className="p-4 bg-v-05 border border-white/10">
                                    <p className="t-meta text-v-40 mb-2">Message Visibility</p>
                                    <p className="text-[11px] text-v-40 leading-relaxed">
                                        {chatSettings.default_vanish_hours
                                            ? `Messages vanish after ${chatSettings.default_vanish_hours} hour(s).`
                                            : 'Messages are permanent.'
                                        }
                                    </p>
                                    {chatType === 'group' && (
                                        <p className="text-[10px] text-v-40 mt-3 opacity-60">
                                            Only the group admin can change these settings.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* User Details Modal */}
            <UserDetailsModal
                isOpen={showUserDetails}
                onClose={() => setShowUserDetails(false)}
                chatId={chatId}
                chatType={chatType}
                userId={user.id}
                friendId={friendId}
                onGroupDeleted={() => window.location.reload()}
                onLeftGroup={() => window.location.reload()}
            />
        </div>
    )
}
