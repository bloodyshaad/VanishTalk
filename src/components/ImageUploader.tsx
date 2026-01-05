import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Image, X, Upload, Loader2 } from 'lucide-react'

interface ImageUploaderProps {
    chatId: string
    userId: string
    onImageSelect: (url: string, type: string) => void
    onClear: () => void
    selectedImage: string | null
}

export const ImageUploader = ({ chatId, userId, onImageSelect, onClear, selectedImage }: ImageUploaderProps) => {
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB')
            return
        }

        setError(null)
        setUploading(true)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${chatId}/${userId}_${Date.now()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('chat-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('chat-images')
                .getPublicUrl(fileName)

            onImageSelect(data.publicUrl, file.type)
        } catch (err: any) {
            console.error('Upload error:', err)
            setError(err.message || 'Failed to upload image')
        }

        setUploading(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('image/')) {
            // Create a synthetic event for handleFileSelect
            const input = fileInputRef.current
            if (input) {
                const dt = new DataTransfer()
                dt.items.add(file)
                input.files = dt.files
                input.dispatchEvent(new Event('change', { bubbles: true }))
            }
        }
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) {
                    const input = fileInputRef.current
                    if (input) {
                        const dt = new DataTransfer()
                        dt.items.add(file)
                        input.files = dt.files
                        input.dispatchEvent(new Event('change', { bubbles: true }))
                    }
                }
                break
            }
        }
    }

    if (selectedImage) {
        return (
            <div className="relative mx-6 mb-2">
                <div className="relative inline-block">
                    <img
                        src={selectedImage}
                        alt="Preview"
                        className="h-20 object-cover border border-white/20"
                    />
                    <button
                        onClick={onClear}
                        className="absolute -top-2 -right-2 p-1 bg-black border border-white/30 text-white hover:bg-red-500 hover:border-red-500 transition-all"
                    >
                        <X size={12} />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="relative">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            <button
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                disabled={uploading}
                className="p-2 text-v-40 hover:text-white transition-colors disabled:opacity-50"
                title="Send image"
            >
                {uploading ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : (
                    <Image size={18} strokeWidth={1.5} />
                )}
            </button>

            {error && (
                <div className="absolute bottom-full mb-2 left-0 px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] whitespace-nowrap">
                    {error}
                </div>
            )}
        </div>
    )
}

// Image viewer/lightbox component
interface ImageLightboxProps {
    src: string
    onClose: () => void
}

export const ImageLightbox = ({ src, onClose }: ImageLightboxProps) => {
    return (
        <div
            className="fixed inset-0 bg-black/95 z-[100000] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-3 text-white/60 hover:text-white border border-white/20 hover:border-white/40 transition-all"
            >
                <X size={20} />
            </button>
            <img
                src={src}
                alt="Full size"
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    )
}
