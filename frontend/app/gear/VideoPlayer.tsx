'use client'

import {useRef, useState} from 'react'

function SpeakerIcon({muted}: {muted: boolean}) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </>
      )}
    </svg>
  )
}

export function VideoPlayer({src}: {src: string}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [volume, setVolume] = useState(0.7)

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    if (muted) {
      video.muted = false
      video.volume = volume
      setMuted(false)
    } else {
      video.muted = true
      setMuted(true)
    }
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value)
    setVolume(v)
    const video = videoRef.current
    if (!video) return
    video.volume = v
    if (v === 0) {
      video.muted = true
      setMuted(true)
    } else {
      video.muted = false
      setMuted(false)
    }
  }

  return (
    <div className="group relative aspect-[9/16] rounded-3xl overflow-hidden ring-1 ring-bg/10 shadow-2xl bg-black">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Controls — appear on hover */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
        <div className="flex items-center gap-3 bg-black/55 backdrop-blur-md rounded-full px-4 py-2.5">
          <button
            onClick={toggleMute}
            className="text-white/70 hover:text-white transition-colors duration-150 flex items-center"
            aria-label={muted ? 'Unmute video' : 'Mute video'}
          >
            <SpeakerIcon muted={muted} />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-0.5 cursor-pointer rounded-full appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  )
}
