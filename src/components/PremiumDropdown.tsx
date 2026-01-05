import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface DropdownOption {
    value: string
    label: string
}

interface PremiumDropdownProps {
    options: DropdownOption[]
    value: string | null
    onChange: (value: string | null) => void
    placeholder?: string
    compact?: boolean
}

export const PremiumDropdown = ({
    options,
    value,
    onChange,
    placeholder = 'Select',
    compact = false
}: PremiumDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(o => o.value === value)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (optionValue: string) => {
        onChange(optionValue === '' ? null : optionValue)
        setIsOpen(false)
    }

    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center justify-between gap-3
                    bg-gradient-to-b from-white/[0.03] to-transparent
                    border border-white/10 hover:border-white/30
                    transition-all duration-300 ease-out
                    ${compact
                        ? 'px-3 py-2 text-[10px] min-w-[120px]'
                        : 'px-4 py-3 text-[12px] w-full'
                    }
                    ${isOpen ? 'border-white/40 bg-white/[0.05]' : ''}
                `}
            >
                <span className={`
                    font-semibold tracking-[0.15em] uppercase
                    ${selectedOption ? 'text-white' : 'text-white/40'}
                `}>
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown
                    size={compact ? 12 : 14}
                    className={`
                        text-white/40 transition-transform duration-300
                        ${isOpen ? 'rotate-180 text-white' : ''}
                    `}
                    strokeWidth={2}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className={`
                    absolute z-50 mt-2
                    ${compact ? 'min-w-[160px] right-0' : 'w-full'}
                    bg-black/95 backdrop-blur-xl
                    border border-white/15
                    shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]
                    animate-dropdown
                    overflow-hidden
                `}>
                    {/* Gradient top accent */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                    <div className="py-1">
                        {options.map((option, index) => {
                            const isSelected = option.value === value || (option.value === '' && value === null)
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                        w-full flex items-center justify-between
                                        px-4 py-3 text-left
                                        transition-all duration-200
                                        ${isSelected
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                    style={{
                                        animationDelay: `${index * 30}ms`
                                    }}
                                >
                                    <span className={`
                                        text-[11px] font-semibold tracking-[0.12em] uppercase
                                        ${isSelected ? 'text-white' : ''}
                                    `}>
                                        {option.label}
                                    </span>
                                    {isSelected && (
                                        <Check size={12} className="text-white" strokeWidth={2.5} />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Gradient bottom accent */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                </div>
            )}
        </div>
    )
}
