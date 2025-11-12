#pragma once
#include <switch.h>
#include "play_event_buffer.hpp"

class PlayEventMonitor {
    public:
        PlayEventMonitor();

        Result ScanPlayEvents();
        const PlayEventData *GetEventData();
        void FreeEventData();

    private:
        PlayEventBuffer m_event_buffer;
        s32 m_next_event_index;
};
