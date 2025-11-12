#pragma once
#include <switch.h>

namespace cfg {

    struct ModuleConfig {
        u64 event_polling_interval;
        char endpoint_url[0x100];
    };

    const ModuleConfig *LoadConfig();

}
