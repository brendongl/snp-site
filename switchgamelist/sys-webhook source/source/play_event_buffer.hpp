#pragma once
#include <switch.h>

struct PlayEventData {
    u64 title_id;
    s32 controller_count;
    u8 applet_event;
};

class PlayEventBuffer {
    public:
        static constexpr size_t MaxBufferSize = 100;

    public:
        PlayEventBuffer() : m_capacity(MaxBufferSize), m_count(0), m_head(0), m_tail(0) { }

        // Inserts an element into the buffer (returns false if full)
        bool Push(const PlayEventData& data) {
            if (this->IsFull())
                return false;

            m_buffer[m_tail] = data;
            m_tail = (m_tail + 1) % m_capacity;
            m_count++;
            return true;
        }

        // Removes the oldest element (returns false if empty)
        bool Pop(PlayEventData& out) {
            if (this->IsEmpty())
                return false;

            out = m_buffer[m_head];
            m_head = (m_head + 1) % m_capacity;
            m_count--;
            return true;
        }

        const PlayEventData *Peek() {
            if (this->IsEmpty())
                return nullptr;

            return &m_buffer[m_head];
        }

        void Free() {
            if (!this->IsEmpty()) {
                m_head = (m_head + 1) % m_capacity;
                m_count--;
            }
        }

        // Current number of elements
        size_t Size() const {
            return m_count;
        }

        // Capacity of the buffer
        size_t Capacity() const {
            return m_capacity;
        }

        bool IsEmpty() const {
            return m_count == 0;
        }

        bool IsFull() const {
            return m_count == m_capacity;
        }

        // Clear all elements
        void Clear() {
            m_head = m_tail = m_count = 0;
        }

    private:
        PlayEventData m_buffer[MaxBufferSize];
        size_t m_capacity;
        size_t m_count;
        size_t m_head;
        size_t m_tail;
};
