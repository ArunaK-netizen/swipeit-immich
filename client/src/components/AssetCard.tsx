"use client"

import React, { useMemo } from "react"
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from "framer-motion"
import { ImmichAsset } from "@/types/immich"
import { useAuth } from "@/context/AuthContext"
import { X, Check, Undo2 } from "lucide-react"

interface AssetCardProps {
    asset: ImmichAsset
    onSwipe: (direction: "left" | "right") => void
    index: number
    dragConstraints?: any
}

export function AssetCard({ asset, onSwipe, index }: AssetCardProps) {
    const x = useMotionValue(0)
    const controls = useAnimation()
    const rotate = useTransform(x, [-200, 200], [-30, 30])
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0])

    // Entry animation is now handled by the parent AnimatePresence in page.tsx
    // for smoother card promotion when the front card is swiped away.

    const background = useTransform(
        x,
        [-100, 0, 100],
        ["rgba(239, 68, 68, 0.2)", "rgba(0,0,0,0)", "rgba(34, 197, 94, 0.2)"]
    )

    // Overlay opacity for indicators
    const deleteOpacity = useTransform(x, [-100, -20], [1, 0])
    const keepOpacity = useTransform(x, [20, 100], [0, 1])

    const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.x < -100) {
            await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } })
            onSwipe("left")
        } else if (info.offset.x > 100) {
            await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } })
            onSwipe("right")
        }
    }

    // Construct Image URL
    // We need the server URL and token. 
    // Ideally, valid token is needed for cookies, but for API, we usually pass it in header.
    // Standard <img> tag won't send custom headers.
    // Immich images usually require 'x-immich-api-key' query param or cookie. 
    // We will append `?x-immich-api-key=TOKEN` to the URL.

    const imageUrl = useMemo(() => {
        // Use proxy path. The cookie set in AuthContext will handle the server URL and Auth token.
        // ALWAYS use the generated JPEG thumbnail/preview for performance.
        // The 'preview' size from Immich is high enough quality for screen viewing (usually 1080p+),
        // but significantly smaller (KB vs MB) than the original file.
        return `/api/proxy/assets/${asset.id}/thumbnail?format=JPEG`;
    }, [asset.id]);

    // Simplified fluid container that wraps the image naturally.
    // We rely on the image's intrinsic aspect ratio.
    // Max dimensions ensure it fits on screen.
    return (
        <motion.div
            style={{ x, rotate, background }}
            animate={controls}
            drag={index === 0 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            whileDrag={{ scale: 1.05, cursor: "grabbing" }}
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl md:rounded-[2rem] bg-black shadow-2xl cursor-grab touch-none whitespace-nowrap min-w-[300px]"
        >
            {/* Wrapper to control max size while keeping image ratio */}
            <div className="relative max-h-[65vh] max-w-[90vw] md:max-w-6xl w-fit h-fit flex flex-col">
                {/* Image drives the container size */}
                <img
                    src={imageUrl}
                    alt="Asset"
                    className="max-h-[65vh] w-auto h-auto object-contain pointer-events-none select-none bg-black/50 block"
                    draggable={false}
                />

                {/* Indicators Overlay */}
                <motion.div style={{ opacity: deleteOpacity }} className="absolute right-4 top-4 z-20 rounded-full bg-red-500/80 p-3">
                    <X className="h-6 w-6 text-white" />
                </motion.div>

                <motion.div style={{ opacity: keepOpacity }} className="absolute left-4 top-4 z-20 rounded-full bg-green-500/80 p-3">
                    <Check className="h-6 w-6 text-white" />
                </motion.div>

                {/* Metadata Gradient */}
                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-20">
                    <p className="text-white font-medium truncate drop-shadow-md">{asset.originalFileName}</p>
                    <p className="text-zinc-300 text-sm drop-shadow-md">
                        {new Date(asset.fileCreatedAt).toLocaleDateString()}
                        {asset.exifInfo?.exifImageWidth && ` • ${asset.exifInfo.exifImageWidth}x${asset.exifInfo.exifImageHeight}`}
                    </p>
                </div>
            </div>
        </motion.div>
    )
}
