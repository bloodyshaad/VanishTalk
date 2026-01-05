import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Camera, Loader2, X } from 'lucide-react'

interface AvatarUploadProps {
    userId: string
    currentAvatar: string | null
    onAvatarChange: (url: string | null) => void
    size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
    sm: { width: 40, height: 40, fontSize: 12, iconSize: 12 },
    md: { width: 64, height: 64, fontSize: 18, iconSize: 16 },
    lg: { width: 96, height: 96, fontSize: 24, iconSize: 20 }
}

export const AvatarUpload = ({ userId, currentAvatar, onAvatarChange, size = 'md' }: AvatarUploadProps) => {
    const [uploading, setUploading] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const sizeConfig = SIZES[size]

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) return
        if (file.size > 2 * 1024 * 1024) return // Max 2MB

        setUploading(true)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${userId}.${fileExt}`

            // Delete old avatar if exists
            if (currentAvatar) {
                const oldPath = currentAvatar.split('/').pop()
                if (oldPath) {
                    await supabase.storage.from('avatars').remove([oldPath])
                }
            }

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                })

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            // Update profile
            await supabase
                .from('profiles')
                .update({ avatar_url: data.publicUrl })
                .eq('id', userId)

            onAvatarChange(data.publicUrl)
        } catch (err) {
            console.error('Avatar upload error:', err)
        }

        setUploading(false)
    }

    const removeAvatar = async () => {
        if (!currentAvatar) return

        setUploading(true)
        try {
            const fileName = currentAvatar.split('/').pop()
            if (fileName) {
                await supabase.storage.from('avatars').remove([fileName])
            }

            await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', userId)

            onAvatarChange(null)
        } catch (err) {
            console.error('Remove avatar error:', err)
        }
        setUploading(false)
    }

    return (
        <div
            style={{ position: 'relative', cursor: 'pointer' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {/* Avatar display */}
            <div style={{
                width: sizeConfig.width,
                height: sizeConfig.height,
                border: '1px solid rgba(255,255,255,0.2)',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: sizeConfig.fontSize,
                overflow: 'hidden',
                position: 'relative'
            }}>
                {currentAvatar ? (
                    <img
                        src={currentAvatar}
                        alt="Avatar"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>?</span>
                )}

                {/* Loading overlay */}
                {uploading && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Loader2
                            style={{ animation: 'spin 1s linear infinite' }}
                            size={sizeConfig.iconSize}
                            color="white"
                        />
                    </div>
                )}
            </div>

            {/* Hover overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                opacity: isHovered && !uploading ? 1 : 0,
                transition: 'opacity 0.2s ease'
            }}>
                <Camera size={sizeConfig.iconSize} color="white" />
                {currentAvatar && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            removeAvatar()
                        }}
                        style={{
                            padding: 4,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                        title="Remove avatar"
                    >
                        <X size={sizeConfig.iconSize} color="#f87171" />
                    </button>
                )}
            </div>
        </div>
    )
}

// Simple avatar display component
interface AvatarProps {
    src: string | null
    name: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
    online?: boolean
}

const DISPLAY_SIZES = {
    xs: { width: 24, height: 24, fontSize: 8 },
    sm: { width: 32, height: 32, fontSize: 10 },
    md: { width: 40, height: 40, fontSize: 12 },
    lg: { width: 64, height: 64, fontSize: 18 }
}

export const Avatar = ({ src, name, size = 'sm', online }: AvatarProps) => {
    const sizeConfig = DISPLAY_SIZES[size]

    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                width: sizeConfig.width,
                height: sizeConfig.height,
                border: '1px solid rgba(255,255,255,0.2)',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: sizeConfig.fontSize,
                overflow: 'hidden'
            }}>
                {src ? (
                    <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{name[0]?.toUpperCase() || '?'}</span>
                )}
            </div>
            {online !== undefined && (
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
            )}
        </div>
    )
}
