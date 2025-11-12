#pragma once
#include <switch.h>

#include "play_event_monitor.hpp"

class WebHook {
    public:
        WebHook(const char *endpoint_url) : m_endpoint_url(endpoint_url) {}
        bool PushEvent(const PlayEventData *event_data);

    private:
        bool HttpPostRequest(const char *json_payload);

    private:
        const char *m_endpoint_url;
};
