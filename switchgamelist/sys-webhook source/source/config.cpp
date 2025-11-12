#include "config.hpp"
#include <switch.h>
#include <cstdlib>
#include <cstring>

#include "inih/ini.h"

namespace cfg {

    namespace {

        constexpr const char ConfigIniPath[] = "sdmc:/config/sys-webhook/config.ini";

        constinit ModuleConfig g_webhook_config = {
            .event_polling_interval = 1000000000
        };

        void ParseU64(const char *value, u64 *out, u64 min=0, u64 max=UINT64_MAX) {
            u64 tmp = std::strtol(value, nullptr, 10);
            if ((tmp >= min) && (tmp <= max)) {
                *out = tmp;
            }
        }

        int config_handler(void* user, const char *section, const char *name, const char *value) {
            ModuleConfig *config = (ModuleConfig*)user;

            if (std::strcmp(section, "general") == 0) {
                if (std::strcmp(name, "event_polling_interval_ns") == 0)
                    ParseU64(value, &config->event_polling_interval);
            } else if (std::strcmp(section, "webhook") == 0) {
                if (std::strcmp(name, "endpoint_url") == 0)
                    std::strncpy(config->endpoint_url, value, sizeof(config->endpoint_url) - 1);
            }

            return 1;
        }

    }

    const ModuleConfig *LoadConfig() {
        int res = ini_parse(ConfigIniPath, config_handler, &g_webhook_config);
        if (res < 0)
            fatalThrow(res);

        return &g_webhook_config;
    }

}
