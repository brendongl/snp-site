'use client';

import Image from 'next/image';

export function BrandHeader() {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="flex items-start gap-3">
        {/* Logo Container */}
        <div className="flex-shrink-0">
          <Image
            src="/logo-sipnplay.jpg"
            alt="Sip n Play Logo"
            width={80}
            height={80}
            className="w-16 h-auto"
            priority
          />
        </div>

        {/* Header Content */}
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#00B4D8] mb-1">
            Sip n Play
          </h1>
          <p className="text-sm leading-relaxed text-gray-600">
            Search through all our games, pick the perfect game for your number of players, preferences, and more
          </p>
        </div>
      </div>
    </div>
  );
}
