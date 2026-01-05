import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

interface AudioPlayerProps {
    src: string
    duration?: number
}

export const AudioPlayer = ({ src, duration }: AudioPlayerProps) => {
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [totalDuration, setTotalDuration] = useState(duration || 0)
    const audioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
        const handleEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }
        const handleLoadedMetadata = () => {
            if (!duration && audio.duration !== Infinity) {
                setTotalDuration(audio.duration)
            }
        }

        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('loadedmetadata', handleLoadedMetadata)

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('ended', handleEnded)
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        }
    }, [duration])

    const togglePlay = () => {
        if (!audioRef.current) return

        if (isPlaying) {
            audioRef.current.pause()
        } else {
            audioRef.current.play()
        }
        setIsPlaying(!isPlaying)
    }

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !totalDuration) return

        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = x / rect.width
        const newTime = percentage * totalDuration

        audioRef.current.currentTime = newTime
        setCurrentTime(newTime)
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

    return (
        <div className="flex items-center space-x-3 p-2 bg-v-05 border border-white/10 min-w-[200px]">
            <audio ref={audioRef} src={src} preload="metadata" />

            <button
                onClick={togglePlay}
                className="p-2 bg-white/10 hover:bg-white/20 transition-colors"
            >
                {isPlaying ? (
                    <Pause size={16} color="white" fill="white" />
                ) : (
                    <Play size={16} color="white" fill="white" />
                )}
            </button>

            <div className="flex-1 space-y-1">
                {/* Progress bar */}
                <div
                    onClick={handleSeek}
                    className="h-1.5 bg-white/10 cursor-pointer relative"
                >
                    <div
                        className="h-full bg-white/60 transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Time */}
                <div className="flex justify-between text-[10px] text-v-40">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(totalDuration)}</span>
                </div>
            </div>

            <Volume2 size={14} className="text-v-40" />
        </div>
    )
}
