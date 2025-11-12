#include "log.hpp"
#include <cstdio>
#include <memory>

namespace dbg::log {

    namespace {

        // constexpr const char LogFilePath[] = "sdmc:/sys-webhook.log";
        constexpr const char LogFilePath[] = "/sys-webhook.log";
        FsFile LogFile;
        s64 LogOffset = 0;
        Mutex g_log_lock;

    }

    Result Initialize() {
        Result rc = 0;

        // Init mutex
        mutexInit(&g_log_lock);

        // Open the sd card filesystem
        FsFileSystem fs;
        rc = fsOpenSdCardFileSystem(&fs);
        if (R_FAILED(rc)) return rc;

        // Check if log file exists and create it if not
        rc = fsFsOpenFile(&fs, LogFilePath, FsOpenMode_Read, &LogFile);
        if (R_FAILED(rc)) {
            // File doesn’t exist — create it
            rc = fsFsCreateFile(&fs, LogFilePath, 0, 0);
            if (R_FAILED(rc)) {
                fsFsClose(&fs);
                return rc;
            }
        } else {
            fsFileClose(&LogFile);
        }

        // Open for writing (append)
        rc = fsFsOpenFile(&fs, LogFilePath, FsOpenMode_Write | FsOpenMode_Append, &LogFile);
        if (R_FAILED(rc)) {
            fsFsClose(&fs);
            return rc;
        }

        // Get file size (write offset)
        rc = fsFileGetSize(&LogFile, &LogOffset);
        if (R_FAILED(rc)) {
            fsFileClose(&LogFile);
            fsFsClose(&fs);
            return rc;
        }
        
        char buff[0x100];
        int len = snprintf(buff, sizeof(buff), "\n======================== LOG STARTED ========================\n");
        rc = fsFileWrite(&LogFile, LogOffset, buff, len, FsWriteOption_Flush);
        if (R_FAILED(rc)) goto _close;
        LogOffset += len;

        // len = snprintf(buff, sizeof(buff), "Build: Unknown (replace with constants)\n");
        // rc = fsFileWrite(&LogFile, LogOffset, buff, len, FsWriteOption_Flush);
        // if (R_FAILED(rc)) goto _close;
        // LogOffset += len;

    _close:
        fsFileClose(&LogFile);
        fsFsClose(&fs);
        return rc;
    }

    void Finalize() {
        fsFileFlush(&LogFile);
        fsFileClose(&LogFile);
    }

    void DebugLogImpl(const char *fmt, std::va_list args) {
        FsFileSystem fs;
        Result rc = fsOpenSdCardFileSystem(&fs);
        if (R_FAILED(rc)) return;

        rc = fsFsOpenFile(&fs, LogFilePath, FsOpenMode_Write | FsOpenMode_Append, &LogFile);
        if (R_FAILED(rc)) {
            fsFsClose(&fs);
            return;
        }

        char buff[0x400];
        int len = 0;

        u64 ticks = armGetSystemTick();
        u64 tick_freq = armGetSystemTickFreq();
        u64 ms = (ticks * 1000) / tick_freq;

        len = snprintf(buff, sizeof(buff), "[ts: %6lums] ", ms);
        fsFileWrite(&LogFile, LogOffset, buff, len, FsWriteOption_None);
        LogOffset += len;

        len = vsnprintf(buff, sizeof(buff), fmt, args);
        fsFileWrite(&LogFile, LogOffset, buff, len, FsWriteOption_Flush);
        LogOffset += len;

        fsFileClose(&LogFile);
        fsFsClose(&fs);
    }

    void DebugLog(const char *fmt, ...) {
        mutexLock(&g_log_lock);

        std::va_list args;
        va_start(args, fmt);
        DebugLogImpl(fmt, args);
        va_end(args);

        mutexUnlock(&g_log_lock);
    }

    void DebugDataDumpImpl(const void *data, size_t size) {
        FsFileSystem fs;
        Result rc = fsOpenSdCardFileSystem(&fs);
        if (R_FAILED(rc)) return;

        rc = fsFsOpenFile(&fs, LogFilePath, FsOpenMode_Write | FsOpenMode_Append, &LogFile);
        if (R_FAILED(rc)) {
            fsFsClose(&fs);
            return;
        }

        size_t buff_size = 4 * size + 1;
        std::unique_ptr<char[]> buff(new char[buff_size]);

        int len = 0;
        for (size_t i = 0; i < size; ++i) {
            if ((i % 16) == 0)
                len += snprintf(buff.get() + len, buff_size - len, " ");
            len += snprintf(buff.get() + len, buff_size - len, "%02x%c",
                            ((const u8*)data)[i], ((i + 1) % 16) ? ' ' : '\n');
        }
        len += snprintf(buff.get() + len, buff_size - len, "\n");

        fsFileWrite(&LogFile, LogOffset, buff.get(), len, FsWriteOption_Flush);
        LogOffset += len;

        fsFileClose(&LogFile);
        fsFsClose(&fs);
    }

    void DebugDataDump(const void *data, size_t size, const char *fmt, ...) {
        mutexLock(&g_log_lock);

        std::va_list args;
        va_start(args, fmt);
        DebugLogImpl(fmt, args);
        va_end(args);
        DebugDataDumpImpl(data, size);

        mutexUnlock(&g_log_lock);
    }

}
