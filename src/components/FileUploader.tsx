import { useState, useRef } from 'react'
import { Paperclip, Loader2, X, FileText, FileImage, File } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface FileUploaderProps {
    chatId: string
    userId: string
    onSent: () => void
    vanishMinutes?: number | null
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return FileImage
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return FileText
    return File
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const FileUploader = ({ chatId, userId, onSent, vanishMinutes }: FileUploaderProps) => {
    const [uploading, setUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > MAX_FILE_SIZE) {
            alert('File too large. Maximum size is 10MB.')
            return
        }

        setSelectedFile(file)
    }

    const clearFile = () => {
        setSelectedFile(null)
        if (inputRef.current) {
            inputRef.current.value = ''
        }
    }

    const uploadFile = async () => {
        if (!selectedFile) return

        setUploading(true)
        const ext = selectedFile.name.split('.').pop() || 'bin'
        const fileName = `${userId}/${Date.now()}.${ext}`

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(fileName, selectedFile)

        if (uploadError) {
            console.error('Upload error:', uploadError)
            setUploading(false)
            return
        }

        const { data: urlData } = supabase.storage
            .from('chat-files')
            .getPublicUrl(uploadData.path)

        // Create message with file
        const { error: msgError } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                sender_id: userId,
                content: `📎 ${selectedFile.name}`,
                file_url: urlData.publicUrl,
                file_type: selectedFile.type,
                file_name: selectedFile.name,
                vanish_at: vanishMinutes
                    ? new Date(Date.now() + vanishMinutes * 60 * 1000).toISOString()
                    : null
            })

        if (msgError) {
            console.error('Message error:', msgError)
        } else {
            onSent()
            clearFile()
        }

        setUploading(false)
    }

    const FileIcon = selectedFile ? getFileIcon(selectedFile.type) : File

    return (
        <div className="flex items-center">
            <input
                ref={inputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept="*/*"
            />

            {selectedFile ? (
                <div className="flex items-center space-x-2 bg-v-05 border border-white/10 px-3 py-1.5">
                    <FileIcon size={16} className="text-v-40" />
                    <span className="text-xs text-white/80 max-w-[120px] truncate">
                        {selectedFile.name}
                    </span>
                    <span className="text-xs text-v-40">
                        ({formatFileSize(selectedFile.size)})
                    </span>
                    {uploading ? (
                        <Loader2 size={14} className="animate-spin text-white/40" />
                    ) : (
                        <>
                            <button
                                onClick={uploadFile}
                                className="text-green-400 hover:text-green-300 text-xs font-bold"
                            >
                                Send
                            </button>
                            <button
                                onClick={clearFile}
                                className="text-v-40 hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => inputRef.current?.click()}
                    className="p-2 text-v-40 hover:text-white transition-colors"
                    title="Attach file"
                >
                    <Paperclip size={20} strokeWidth={1.5} />
                </button>
            )}
        </div>
    )
}
