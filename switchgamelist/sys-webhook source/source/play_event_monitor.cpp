#include "play_event_monitor.hpp"
#include <cstring>

#include "log.hpp"

namespace {

    constexpr size_t MaxGamepads = 8;

    constexpr size_t MaxPlayEvents = 10;
    constinit PdmPlayEvent g_play_events[MaxPlayEvents] = {};

    s32 GetNumberConnectedControllers() {
        s32 count;
        HidsysUniquePadId pad_ids[MaxGamepads];
        Result rc = hidsysGetUniquePadIds(pad_ids, MaxGamepads, &count);
        if (R_FAILED(rc))
            fatalThrow(rc);

        return count;
    }

    s32 GetLatestPlayEventIndex() {
        s32 total_entries, start_idx, end_idx;
        Result rc = pdmqryGetAvailablePlayEventRange(&total_entries, &start_idx, &end_idx);
        if (R_FAILED(rc))
            fatalThrow(rc);

        return end_idx;
    }

}

PlayEventMonitor::PlayEventMonitor() {
    m_next_event_index = GetLatestPlayEventIndex() + 1;
}

Result PlayEventMonitor::ScanPlayEvents() {
    Result rc = 0;
    PlayEventData event_data = {};

    s32 end_idx = GetLatestPlayEventIndex();

    s32 total_out;
    while (m_next_event_index <= end_idx) {
        // Grab the next block of play events
        rc = pdmqryQueryPlayEvent(m_next_event_index, g_play_events, MaxPlayEvents, &total_out);
        if (R_FAILED(rc))
            return rc;

        // Safeguard against entering an infinite loop
        if (total_out == 0)
            break;

        // Iterate over the new events
        for (int i = 0; i < total_out; ++i) {
            // Only include application events of type launch or exit
            if (g_play_events[i].play_event_type == PdmPlayEventType_Applet && g_play_events[i].event_data.applet.applet_id == AppletId_application) {
                if (g_play_events[i].event_data.applet.event_type  == PdmAppletEventType_Launch || g_play_events[i].event_data.applet.event_type  == PdmAppletEventType_Exit) {

                    // Assemble event data
                    event_data.title_id = ((u64)g_play_events[i].event_data.applet.program_id[0] << 32) | g_play_events[i].event_data.applet.program_id[1];
                    event_data.controller_count = GetNumberConnectedControllers();
                    event_data.applet_event = g_play_events[i].event_data.applet.event_type;

                    // Push the event to the buffer
                    m_event_buffer.Push(event_data);
                }
            }
        }

        m_next_event_index += total_out;
    }

    return 0;
}

const PlayEventData *PlayEventMonitor::GetEventData() {
    return m_event_buffer.Peek();
}

void PlayEventMonitor::FreeEventData() {
    m_event_buffer.Free();
}
