import { supabase } from './supabase'

let lastSeenInterval: ReturnType<typeof setInterval> | null = null

// Update user's last_seen timestamp periodically
export const startPresenceTracking = () => {
    // Update immediately
    updateLastSeen()

    // Then update every 30 seconds
    if (lastSeenInterval) clearInterval(lastSeenInterval)
    lastSeenInterval = setInterval(updateLastSeen, 30000)

    // Also update on visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange)
}

export const stopPresenceTracking = () => {
    if (lastSeenInterval) {
        clearInterval(lastSeenInterval)
        lastSeenInterval = null
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
}

const updateLastSeen = async () => {
    try {
        await supabase.rpc('update_last_seen')
    } catch (error) {
        console.error('Failed to update last_seen:', error)
    }
}

const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
        updateLastSeen()
    }
}

// Format last seen time as readable string
export const formatLastSeen = (lastSeen: string | null): string => {
    if (!lastSeen) return 'Offline'

    const lastSeenDate = new Date(lastSeen)
    const now = new Date()
    const diffMs = now.getTime() - lastSeenDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    // Consider online if seen within last 2 minutes
    if (diffMins < 2) return 'Online'
    if (diffMins < 60) return `Last seen ${diffMins}m ago`
    if (diffHours < 24) return `Last seen ${diffHours}h ago`
    if (diffDays < 7) return `Last seen ${diffDays}d ago`

    return 'Offline'
}

// Check if user is online (seen within last 2 minutes)
export const isUserOnline = (lastSeen: string | null): boolean => {
    if (!lastSeen) return false
    const diffMs = Date.now() - new Date(lastSeen).getTime()
    return diffMs < 120000 // 2 minutes
}

// Browser Notifications
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
        console.log('Notifications not supported')
        return false
    }

    if (Notification.permission === 'granted') {
        console.log('Notification permission already granted')
        return true
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        console.log('Notification permission result:', permission)
        return permission === 'granted'
    }

    console.log('Notification permission denied')
    return false
}

export const sendNotification = (title: string, body: string, onClick?: () => void) => {
    // Check actual browser permission, not cached variable
    if (!('Notification' in window)) {
        console.log('Notifications not supported in this browser')
        return
    }

    if (Notification.permission !== 'granted') {
        console.log('Notification permission not granted:', Notification.permission)
        return
    }

    // Don't notify if tab is active
    if (document.visibilityState === 'visible') {
        console.log('Tab is visible, skipping notification')
        return
    }

    try {
        const notification = new Notification(title, {
            body,
            icon: '/vite.svg',
            badge: '/vite.svg',
            tag: 'vanish-message',
            silent: false
        })

        console.log('Notification sent:', title)

        if (onClick) {
            notification.onclick = () => {
                window.focus()
                onClick()
            }
        }

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000)
    } catch (error) {
        console.error('Failed to create notification:', error)
    }
}

// Read Receipts
export const markMessagesAsRead = async (_chatId: string, userId: string, messageIds: string[]) => {
    if (messageIds.length === 0) return

    const reads = messageIds.map(id => ({
        message_id: id,
        user_id: userId
    }))

    await supabase
        .from('message_reads')
        .upsert(reads, { onConflict: 'message_id,user_id' })
}

export const getUnreadCount = async (userId: string, messageIds: string[]): Promise<number> => {
    if (messageIds.length === 0) return 0

    // Get messages user has read
    const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', userId)
        .in('message_id', messageIds)

    const readIds = new Set(reads?.map(r => r.message_id) || [])
    return messageIds.filter(id => !readIds.has(id)).length
}
