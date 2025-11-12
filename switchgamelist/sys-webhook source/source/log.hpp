#pragma once
#include <switch.h>
#include <cstdarg>

namespace dbg::log {

    Result Initialize();
    void Finalize();

    void DebugLog(const char *fmt, ...);
    void DebugDataDump(const void *data, size_t size, const char *fmt, ...);

    #define DEBUG_LOG(fmt, ...) ::dbg::log::DebugLog(fmt "\n", ##__VA_ARGS__)
    #define DEBUG_DATA_DUMP(data, size, fmt, ...) ::dbg::log::DebugDataDump(data, size, fmt "\n", ##__VA_ARGS__)

}
