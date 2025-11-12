#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <switch.h>
#include <curl/curl.h>

#include "config.hpp"
#include "webhook.hpp"
#include "play_event_monitor.hpp"

#include "log.hpp"

constinit u32 g_hos_version = 0;
constinit u32 g_ams_version = 0;
constinit SetSysSerialNumber g_serial = {};

constexpr SocketInitConfig SocketConfig = {
    .tcp_tx_buf_size = 0x8000,
    .tcp_rx_buf_size = 0x4000,
    .tcp_tx_buf_max_size = 0,
    .tcp_rx_buf_max_size = 0,
    .udp_tx_buf_size = 0,
    .udp_rx_buf_size = 0,
    .sb_efficiency = 1,
    .num_bsd_sessions = 1,
    .bsd_service_type = BsdServiceType_System
};

struct ExosphereApiInfo {
    union {
        u64 raw;
        struct {
            u64 target_firmare_version : 32;
            u64 master_key_revision    :  8;
            u64 micro_version          :  8;
            u64 minor_version          :  8;
            u64 major_version          :  8;
        };
    };
};

// Size of the inner heap (adjust as necessary).
#define INNER_HEAP_SIZE 0x20000

#ifdef __cplusplus
extern "C" {
#endif

// Sysmodules should not use applet*.
u32 __nx_applet_type = AppletType_None;

// Sysmodules will normally only want to use one FS session.
u32 __nx_fs_num_sessions = 1;

SslServiceType __nx_ssl_service_type = SslServiceType_System;

// Newlib heap configuration function (makes malloc/free work).
void __libnx_initheap(void) {
    static u8 inner_heap[INNER_HEAP_SIZE];
    extern void* fake_heap_start;
    extern void* fake_heap_end;

    // Configure the newlib heap.
    fake_heap_start = inner_heap;
    fake_heap_end   = inner_heap + sizeof(inner_heap);
}

// Service initialization.
void __appInit(void) {
    Result rc;

    rc = smInitialize();
    if (R_FAILED(rc))
        fatalThrow(MAKERESULT(Module_Libnx, LibnxError_InitFail_SM));

    rc = setsysInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    SetSysFirmwareVersion fw;
    rc = setsysGetFirmwareVersion(&fw);
    if (R_SUCCEEDED(rc))
        hosversionSet(MAKEHOSVERSION(fw.major, fw.minor, fw.micro));

    g_hos_version = hosversionGet();

    rc = setsysGetSerialNumber(&g_serial);
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = splInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    ExosphereApiInfo api_info;
    rc = splGetConfig((SplConfigItem)65000, &api_info.raw);
    if (R_SUCCEEDED(rc))
        g_ams_version = (api_info.major_version << 16) | (api_info.minor_version << 8) | (api_info.micro_version);

    splExit();

    rc = fsInitialize();
    if (R_FAILED(rc))
        fatalThrow(MAKERESULT(Module_Libnx, LibnxError_InitFail_FS));

    fsdevMountSdmc();

    rc = setInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = pmdmntInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = pdmqryInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = hidsysInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = nsInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = socketInitialize(&SocketConfig);
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = sslInitialize(3);
    if (R_FAILED(rc)) fatalThrow(rc);

    rc = csrngInitialize();
    if (R_FAILED(rc)) fatalThrow(rc);

    smExit();
}

// Service deinitialization.
void __appExit(void) {
    csrngExit();
    sslExit();
    socketExit();
    nsExit();
    hidsysExit();
    pdmqryExit();
    pmdmntExit();
    setExit();
    setsysExit();
    fsdevUnmountAll();
    fsExit();
}

#ifdef __cplusplus
}
#endif

PlayEventMonitor g_event_monitor;

class SysWebhook {
    public:
        static void Run() {
            // Read module configuration file
            const cfg::ModuleConfig *config = cfg::LoadConfig();

            // Create and run an instance
            SysWebhook instance(config);
            Result rc = instance.MainLoop();
            if (R_FAILED(rc))
                fatalThrow(rc);
        }

    private:
        SysWebhook(const cfg::ModuleConfig *config) : m_webhook(config->endpoint_url) {
            int res = curl_global_init(CURL_GLOBAL_DEFAULT);
            if (res != CURLE_OK) {
                fatalThrow(res);
            }

            utimerCreate(&m_polling_timer, config->event_polling_interval, TimerType_Repeating);
        }

        ~SysWebhook() {
            curl_global_cleanup();
        }

        Result MainLoop() {
            Result rc = 0;

            utimerStart(&m_polling_timer);

            while (true) {
                rc = waitSingle(waiterForUTimer(&m_polling_timer), -1);
                if (R_SUCCEEDED(rc)) {
                    // Check for new play events
                    rc = g_event_monitor.ScanPlayEvents();
                    if (R_FAILED(rc))
                        fatalThrow(rc);

                    // Loop over any unsent events
                    while (auto event_data = g_event_monitor.GetEventData()) {
                        // Try to push the event out over the network. Break and wait for next loop iteration to try again on failure
                        if (!m_webhook.PushEvent(event_data)) {
                            DEBUG_LOG("Failed to push webhook event!");
                            break;
                        }

                        // Free the event if it has been successfully pushed
                        g_event_monitor.FreeEventData();
                    }
                }
            }

            utimerStop(&m_polling_timer);

            return rc;
        }

    private:
        UTimer m_polling_timer;
        WebHook m_webhook;
};

// Main program entrypoint
int main(int argc, char* argv[]) {
    dbg::log::Initialize();
    SysWebhook::Run();
    return 0;
}
