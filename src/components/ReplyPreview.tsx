import { CornerUpRight, X } from 'lucide-react'

interface ReplyPreviewProps {
    replyTo: {
        id: string
        content: string
        sender_id: string
    }
    senderName: string
    onClear: () => void
    compact?: boolean
}

export const ReplyPreview = ({ replyTo, senderName, onClear, compact = false }: ReplyPreviewProps) => {
    return (
        <div className={`
            flex items-center justify-between gap-3
            ${compact
                ? 'px-3 py-2 bg-white/5 border-l-2 border-white/30'
                : 'px-4 py-3 bg-v-05 border-l-2 border-white/40'
            }
        `}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <CornerUpRight size={12} className="text-white/40 flex-shrink-0" />
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                        Replying to {senderName}
                    </p>
                    <p className="text-[11px] text-white/40 truncate">
                        {replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? '...' : ''}
                    </p>
                </div>
            </div>
            <button
                onClick={onClear}
                className="p-1 text-white/40 hover:text-white transition-colors flex-shrink-0"
            >
                <X size={14} />
            </button>
        </div>
    )
}

interface QuotedMessageProps {
    content: string
    senderName: string
    isOwnMessage: boolean
}

export const QuotedMessage = ({ content, senderName, isOwnMessage }: QuotedMessageProps) => {
    return (
        <div className={`
            px-3 py-2 mb-2 border-l-2 
            ${isOwnMessage
                ? 'bg-black/20 border-black/40'
                : 'bg-white/5 border-white/30'
            }
        `}>
            <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isOwnMessage ? 'text-black/50' : 'text-white/50'}`}>
                {senderName}
            </p>
            <p className={`text-[11px] ${isOwnMessage ? 'text-black/60' : 'text-white/60'}`}>
                {content.slice(0, 80)}{content.length > 80 ? '...' : ''}
            </p>
        </div>
    )
}
