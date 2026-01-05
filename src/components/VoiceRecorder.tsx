import { useState, useRef } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface VoiceRecorderProps {
    chatId: string
    userId: string
    onSent: () => void
    vanishMinutes?: number | null
}

export const VoiceRecorder = ({ chatId, userId, onSent, vanishMinutes }: VoiceRecorderProps) => {
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [uploading, setUploading] = useState(false)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })

            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                await uploadAudio(blob)

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)
        } catch (err) {
            console.error('Error accessing microphone:', err)
            alert('Could not access microphone. Please allow microphone permissions.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)

            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }

    const uploadAudio = async (blob: Blob) => {
        setUploading(true)
        const duration = recordingTime
        setRecordingTime(0)

        const fileName = `${userId}/${Date.now()}.webm`

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('voice-messages')
            .upload(fileName, blob, { contentType: 'audio/webm' })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            setUploading(false)
            return
        }

        const { data: urlData } = supabase.storage
            .from('voice-messages')
            .getPublicUrl(uploadData.path)

        // Create message with audio
        const { error: msgError } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                sender_id: userId,
                content: '🎤 Voice message',
                audio_url: urlData.publicUrl,
                audio_duration: duration,
                vanish_at: vanishMinutes
                    ? new Date(Date.now() + vanishMinutes * 60 * 1000).toISOString()
                    : null
            })

        if (msgError) {
            console.error('Message error:', msgError)
        } else {
            onSent()
        }

        setUploading(false)
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (uploading) {
        return (
            <button
                disabled
                className="p-2 text-v-40"
                title="Uploading..."
            >
                <Loader2 size={20} className="animate-spin" />
            </button>
        )
    }

    if (isRecording) {
        return (
            <div className="flex items-center space-x-2">
                <span className="text-red-400 text-xs animate-pulse">
                    ● {formatTime(recordingTime)}
                </span>
                <button
                    onClick={stopRecording}
                    className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/30 transition-colors"
                    title="Stop recording"
                >
                    <Square size={16} fill="currentColor" />
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={startRecording}
            className="p-2 text-v-40 hover:text-white transition-colors"
            title="Record voice message"
        >
            <Mic size={20} strokeWidth={1.5} />
        </button>
    )
}
