#include "webhook.hpp"
#include <cstdio>
#include <cstring>
#include <curl/curl.h>
// #include "nlohmann/json.hpp"
#include "log.hpp"

extern u32 g_hos_version;
extern u32 g_ams_version;
extern SetSysSerialNumber g_serial;

namespace {

    constexpr size_t DisplayVersionLength = 0x10;
    constexpr size_t LanguageEntryLength = 0x200;

    constinit NsApplicationControlData g_control_data = {};

    Result GetApplicationNameAndVersion(u64 program_id, char *program_name, char *display_version) {
        Result rc = 0;

        u64 actual_size;
        rc = nsGetApplicationControlData(NsApplicationControlSource_Storage, program_id, &g_control_data, sizeof(NsApplicationControlData), &actual_size);
        if (R_SUCCEEDED(rc)) {
            NacpLanguageEntry *language_entry;
            rc = nacpGetLanguageEntry(&g_control_data.nacp, &language_entry);
            if (R_SUCCEEDED(rc)) {
                std::memcpy(program_name, language_entry, LanguageEntryLength);
            }

            std::memcpy(display_version, g_control_data.nacp.display_version, DisplayVersionLength);
        }

        return rc;
    }

}

bool WebHook::PushEvent(const PlayEventData *event_data) {
    Result rc = 0;

    char title_version[DisplayVersionLength];
    char title_name[LanguageEntryLength];
    rc = GetApplicationNameAndVersion(event_data->title_id, title_name, title_version);
    if (R_FAILED(rc)) {
        std::strcpy(title_version, "Error");
        std::strcpy(title_name, "Error");
    }

    // Manually format JSON to avoid pulling in additional dependencies and bloating code
    char json_str[0x400];
    std::sprintf(json_str, "{\"serial\":\"%s\",\"hos_version\":\"%d.%d.%d\",\"ams_version\":\"%d.%d.%d\",\"action\":\"%s\",\"title_id\":\"%016lX\",\"title_version\":\"%s\",\"title_name\":\"%s\",\"controller_count\":%d}",
        g_serial.number,
        HOSVER_MAJOR(g_hos_version), HOSVER_MINOR(g_hos_version), HOSVER_MICRO(g_hos_version),
        HOSVER_MAJOR(g_ams_version), HOSVER_MINOR(g_ams_version), HOSVER_MICRO(g_ams_version),
        event_data->applet_event ? "Exit" : "Launch",
        event_data->title_id,
        title_version,
        title_name,
        event_data->controller_count
    );

    return this->HttpPostRequest(json_str);
}

bool WebHook::HttpPostRequest(const char *json_payload) {
    CURL *curl = curl_easy_init();
    if (!curl) {
        DEBUG_LOG("cURL: curl_easy_init failed");
        return false;
    }

    struct curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    // Attempts to optimise memory usage
    // curl_easy_setopt(curl, CURLOPT_BUFFERSIZE, 0x1000);
    // curl_easy_setopt(curl, CURLOPT_DNS_CACHE_TIMEOUT, 0L);
    // curl_easy_setopt(curl, CURLOPT_FORBID_REUSE, 1L);
    // curl_easy_setopt(curl, CURLOPT_FRESH_CONNECT, 1L);
    // curl_easy_setopt(curl, CURLOPT_COOKIEFILE, "");
    // curl_easy_setopt(curl, CURLOPT_VERBOSE, 0L);
    // curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    curl_easy_setopt(curl, CURLOPT_URL, m_endpoint_url);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, std::strlen(json_payload));
    // curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 2);
    // curl_easy_setopt(curl, CURLOPT_TIMEOUT, 4);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10);

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
         DEBUG_LOG("cURL: curl_easy_perform failed (res=%d)", res);
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    return res == CURLE_OK;
}
