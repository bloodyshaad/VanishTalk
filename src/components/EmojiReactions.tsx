import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Reaction {
    emoji: string
    count: number
    hasReacted: boolean
}

interface EmojiReactionsProps {
    messageId: string
    userId: string
    isOwnMessage: boolean
}

const EMOJI_OPTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥']

export const EmojiReactions = ({ messageId, userId, isOwnMessage }: EmojiReactionsProps) => {
    const [reactions, setReactions] = useState<Reaction[]>([])
    const [showPicker, setShowPicker] = useState(false)
    const [loading, setLoading] = useState(false)

    const fetchReactions = async () => {
        const { data } = await supabase
            .from('message_reactions')
            .select('emoji, user_id')
            .eq('message_id', messageId)

        if (data) {
            const grouped = EMOJI_OPTIONS.map(emoji => {
                const matching = data.filter(r => r.emoji === emoji)
                return {
                    emoji,
                    count: matching.length,
                    hasReacted: matching.some(r => r.user_id === userId)
                }
            }).filter(r => r.count > 0)
            setReactions(grouped)
        }
    }

    useEffect(() => {
        fetchReactions()

        // Subscribe to reaction changes
        const channel = supabase
            .channel(`reactions:${messageId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'message_reactions',
                filter: `message_id=eq.${messageId}`
            }, () => {
                fetchReactions()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [messageId, userId])

    const toggleReaction = async (emoji: string) => {
        if (loading) return
        setLoading(true)

        const existingWithSameEmoji = reactions.find(r => r.emoji === emoji && r.hasReacted)

        if (existingWithSameEmoji) {
            // Remove reaction (clicking same emoji again)
            await supabase
                .from('message_reactions')
                .delete()
                .eq('message_id', messageId)
                .eq('user_id', userId)
                .eq('emoji', emoji)
        } else {
            // First, remove any existing reaction from this user on this message
            const userHasOtherReaction = reactions.some(r => r.hasReacted)
            if (userHasOtherReaction) {
                await supabase
                    .from('message_reactions')
                    .delete()
                    .eq('message_id', messageId)
                    .eq('user_id', userId)
            }

            // Add new reaction
            await supabase
                .from('message_reactions')
                .insert({
                    message_id: messageId,
                    user_id: userId,
                    emoji
                })
        }

        setShowPicker(false)
        setLoading(false)
    }

    return (
        <div className="flex items-center gap-1 mt-1">
            {/* Existing reactions */}
            {reactions.map(r => (
                <button
                    key={r.emoji}
                    onClick={() => toggleReaction(r.emoji)}
                    className={`
                        flex items-center gap-1 px-1.5 py-0.5 text-[10px] border transition-all
                        ${r.hasReacted
                            ? 'bg-white/10 border-white/30 text-white'
                            : 'bg-transparent border-white/10 text-white/60 hover:border-white/30'
                        }
                    `}
                >
                    <span>{r.emoji}</span>
                    <span className="font-semibold">{r.count}</span>
                </button>
            ))}

            {/* Add reaction button */}
            <div className="relative">
                <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="px-1.5 py-0.5 text-[10px] border border-transparent hover:border-white/20 text-white/40 hover:text-white transition-all"
                >
                    +
                </button>

                {/* Emoji picker */}
                {showPicker && (
                    <div className={`
                        absolute z-50 ${isOwnMessage ? 'right-0' : 'left-0'} bottom-full mb-1
                        flex gap-1 p-2 bg-black/95 backdrop-blur-xl border border-white/15
                        shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)]
                        animate-dropdown
                    `}>
                        {EMOJI_OPTIONS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => toggleReaction(emoji)}
                                className="p-1.5 hover:bg-white/10 transition-colors text-base"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
