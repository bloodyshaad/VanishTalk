import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Ban, UserX, Loader2 } from 'lucide-react'

interface BlockUserProps {
    userId: string
    targetUserId: string
    targetUsername: string
    onBlockChange?: (isBlocked: boolean) => void
}

export const BlockUser = ({ userId, targetUserId, targetUsername, onBlockChange }: BlockUserProps) => {
    const [isBlocked, setIsBlocked] = useState(false)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        checkBlockStatus()
    }, [userId, targetUserId])

    const checkBlockStatus = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('blocker_id', userId)
            .eq('blocked_id', targetUserId)
            .single()

        setIsBlocked(!!data)
        setLoading(false)
    }

    const toggleBlock = async () => {
        setActionLoading(true)

        if (isBlocked) {
            // Unblock
            await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', userId)
                .eq('blocked_id', targetUserId)

            setIsBlocked(false)
            onBlockChange?.(false)
        } else {
            // Block
            await supabase
                .from('blocked_users')
                .insert({
                    blocker_id: userId,
                    blocked_id: targetUserId
                })

            setIsBlocked(true)
            onBlockChange?.(true)
        }

        setActionLoading(false)
    }

    if (loading) {
        return (
            <button disabled className="flex items-center gap-2 p-3 text-v-40 opacity-50">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[11px]">Loading...</span>
            </button>
        )
    }

    return (
        <button
            onClick={toggleBlock}
            disabled={actionLoading}
            className={`
                flex items-center gap-2 p-3 w-full
                transition-all text-[11px] font-semibold uppercase tracking-wider
                ${isBlocked
                    ? 'text-green-400 hover:bg-green-500/10'
                    : 'text-red-400 hover:bg-red-500/10'
                }
                disabled:opacity-50
            `}
        >
            {actionLoading ? (
                <Loader2 size={14} className="animate-spin" />
            ) : isBlocked ? (
                <UserX size={14} />
            ) : (
                <Ban size={14} />
            )}
            <span>{isBlocked ? `Unblock ${targetUsername}` : `Block ${targetUsername}`}</span>
        </button>
    )
}

// Utility function to check if blocked
export const checkIfBlocked = async (userId: string, targetUserId: string): Promise<boolean> => {
    const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${userId})`)
        .limit(1)

    return (data?.length || 0) > 0
}
