'use client';

import { useState, useEffect, useRef } from 'react';

const COMMON_NAMES = [
    'Hamza', 'Haseeb', 'Abdullah', 'Hammad', 'Salahuddin', 
    'Huzaifa', 'Kashif', 'Mickels', 'Fataim'
];

interface NameAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export default function NameAutocomplete({ 
    value, 
    onChange, 
    placeholder = "Person's Name", 
    required = false,
    className = "" 
}: NameAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val);

        if (val.trim()) {
            const filtered = COMMON_NAMES.filter(name => 
                name.toLowerCase().includes(val.toLowerCase()) && 
                name.toLowerCase() !== val.toLowerCase()
            );
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelect = (name: string) => {
        onChange(name);
        setShowSuggestions(false);
    };

    return (
        <div ref={containerRef} className={`autocomplete-container ${className}`} style={{ position: 'relative', width: '100%' }}>
            <input
                type="text"
                className="form-input"
                placeholder={placeholder}
                value={value}
                onChange={handleInputChange}
                onFocus={() => {
                    if (value.trim()) {
                        const filtered = COMMON_NAMES.filter(name => 
                            name.toLowerCase().includes(value.toLowerCase()) &&
                            name.toLowerCase() !== value.toLowerCase()
                        );
                        if (filtered.length > 0) setShowSuggestions(true);
                    }
                }}
                required={required}
                autoComplete="off"
            />
            {showSuggestions && (
                <div className="autocomplete-suggestions fade-in" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    {suggestions.map((name, index) => (
                        <div
                            key={index}
                            className="suggestion-item"
                            onClick={() => handleSelect(name)}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
