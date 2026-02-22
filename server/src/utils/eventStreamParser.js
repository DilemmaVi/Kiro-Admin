// AWS Event Stream 解析器
// 参考 kiro2api 的 compliant_event_stream_parser.go 实现

class EventStreamParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  // 解析 Event Stream 二进制格式
  parse(chunk) {
    const events = [];
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 12) {
      // 读取消息长度（前4字节，Big-Endian）
      const totalLength = this.buffer.readUInt32BE(0);

      // 检查是否有完整的消息
      if (this.buffer.length < totalLength) {
        break;
      }

      // 读取消息头长度（第5-8字节，Big-Endian）
      const headersLength = this.buffer.readUInt32BE(4);

      // 读取 prelude CRC（第9-12字节）
      const preludeCrc = this.buffer.readUInt32BE(8);

      // 计算 payload 起始位置和长度
      const headersStart = 12;
      const payloadStart = headersStart + headersLength;
      const payloadLength = totalLength - headersLength - 16; // 16 = prelude(12) + message CRC(4)

      // 解析消息头
      const headers = this.parseHeaders(this.buffer.slice(headersStart, payloadStart));

      // 读取 payload
      const payload = this.buffer.slice(payloadStart, payloadStart + payloadLength);

      // 读取消息 CRC（最后4字节）
      const messageCrc = this.buffer.readUInt32BE(payloadStart + payloadLength);

      // 处理事件
      const eventType = headers[':event-type'];
      const contentType = headers[':content-type'];

      if (eventType === 'assistantResponseEvent' && contentType === 'application/json') {
        try {
          const data = JSON.parse(payload.toString('utf-8'));
          if (data.content) {
            events.push({
              type: 'content',
              content: data.content
            });
          }
        } catch (error) {
          console.error('解析 payload 失败:', error);
        }
      } else if (eventType === 'meteringEvent') {
        try {
          const data = JSON.parse(payload.toString('utf-8'));
          events.push({
            type: 'metering',
            usage: data.usage
          });
        } catch (error) {
          console.error('解析 metering 失败:', error);
        }
      }

      // 移除已处理的消息
      this.buffer = this.buffer.slice(totalLength);
    }

    return events;
  }

  // 解析消息头
  parseHeaders(headersBuffer) {
    const headers = {};
    let offset = 0;

    while (offset < headersBuffer.length) {
      // 读取 header name 长度（1字节）
      const nameLength = headersBuffer.readUInt8(offset);
      offset += 1;

      // 读取 header name
      const name = headersBuffer.slice(offset, offset + nameLength).toString('utf-8');
      offset += nameLength;

      // 读取 header value type（1字节）
      const valueType = headersBuffer.readUInt8(offset);
      offset += 1;

      // 读取 header value 长度（2字节，Big-Endian）
      const valueLength = headersBuffer.readUInt16BE(offset);
      offset += 2;

      // 读取 header value
      let value;
      if (valueType === 7) {
        // String type
        value = headersBuffer.slice(offset, offset + valueLength).toString('utf-8');
      } else {
        // 其他类型暂不处理
        value = headersBuffer.slice(offset, offset + valueLength);
      }
      offset += valueLength;

      headers[name] = value;
    }

    return headers;
  }

  // 重置缓冲区
  reset() {
    this.buffer = Buffer.alloc(0);
  }
}

module.exports = EventStreamParser;
