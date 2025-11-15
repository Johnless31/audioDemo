import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  // 麦克风录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  
  // 扬声器录音状态
  const [isRecordingSpeaker, setIsRecordingSpeaker] = useState(false);
  const [speakerAudioUrl, setSpeakerAudioUrl] = useState(null);
  const [speakerAudioBlob, setSpeakerAudioBlob] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const speakerMediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speakerAudioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const destinationRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true
        } 
      });
      
      const options = { 
        mimeType: 'audio/webm;codecs=opus' 
      };
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm'
        });
        
        const url = URL.createObjectURL(blob);
        
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        
        setAudioBlob(blob);
        setAudioUrl(url);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (error) {
      console.error('麦克风录音启动失败:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止麦克风录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 开始录制扬声器（系统音频）
  const startRecordingSpeaker = async () => {
    try {
      // 使用 getDisplayMedia 捕获屏幕音频
      
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true
      });
      // 创建音频上下文来处理音频流
      audioContextRef.current = new AudioContext();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(displayStream);
      destinationRef.current = audioContextRef.current.createMediaStreamDestination();
      
      // 连接源到目标
      sourceRef.current.connect(destinationRef.current);
      
      // 创建 MediaRecorder 来录制目标流
      const options = { 
        mimeType: 'audio/webm;codecs=opus' 
      };
      
      const mediaRecorder = new MediaRecorder(destinationRef.current.stream, options);
      speakerMediaRecorderRef.current = mediaRecorder;
      speakerAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          speakerAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(speakerAudioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm'
        });
        
        const url = URL.createObjectURL(blob);
        
        if (speakerAudioUrl) {
          URL.revokeObjectURL(speakerAudioUrl);
        }
        
        setSpeakerAudioBlob(blob);
        setSpeakerAudioUrl(url);
        
        // 关闭音频上下文和流
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        displayStream.getTracks().forEach(track => track.stop());
      };

      // 监听用户停止共享
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopRecordingSpeaker();
      });

      displayStream.getAudioTracks()[0]?.addEventListener('ended', () => {
        stopRecordingSpeaker();
      });

      mediaRecorder.start();
      setIsRecordingSpeaker(true);
      
    } catch (error) {
      console.error('扬声器录音启动失败:', error);
      alert('无法录制系统音频，请确保您选择了共享音频');
    }
  };

  // 停止扬声器录音
  const stopRecordingSpeaker = () => {
    if (speakerMediaRecorderRef.current && isRecordingSpeaker) {
      speakerMediaRecorderRef.current.stop();
      setIsRecordingSpeaker(false);
    }
  };

  // 下载麦克风录音
  const downloadAudio = () => {
    if (!audioUrl || !audioBlob) {
      alert('没有可下载的麦克风录音文件');
      return;
    }

    try {
      const mimeType = audioBlob.type;
      let fileExtension = '.webm';
      
      if (mimeType.includes('wav')) {
        fileExtension = '.wav';
      } else if (mimeType.includes('mp4') || mimeType.includes('aac')) {
        fileExtension = '.m4a';
      } else if (mimeType.includes('ogg')) {
        fileExtension = '.ogg';
      }

      const downloadLink = document.createElement('a');
      downloadLink.href = audioUrl;
      downloadLink.download = `microphone-recording-${Date.now()}${fileExtension}`;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      console.log('麦克风录音下载成功，文件类型:', mimeType);
      
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请重试');
    }
  };

  // 下载扬声器录音
  const downloadSpeakerAudio = () => {
    if (!speakerAudioUrl || !speakerAudioBlob) {
      alert('没有可下载的扬声器录音文件');
      return;
    }

    try {
      const mimeType = speakerAudioBlob.type;
      let fileExtension = '.webm';
      
      if (mimeType.includes('wav')) {
        fileExtension = '.wav';
      } else if (mimeType.includes('mp4') || mimeType.includes('aac')) {
        fileExtension = '.m4a';
      } else if (mimeType.includes('ogg')) {
        fileExtension = '.ogg';
      }

      const downloadLink = document.createElement('a');
      downloadLink.href = speakerAudioUrl;
      downloadLink.download = `speaker-recording-${Date.now()}${fileExtension}`;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      console.log('扬声器录音下载成功，文件类型:', mimeType);
      
    } catch (error) {
      console.error('扬声器录音下载失败:', error);
      alert('下载失败，请重试');
    }
  };

  // 清理麦克风录音资源
  const cleanup = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
    }
  };

  // 清理扬声器录音资源
  const cleanupSpeaker = () => {
    if (speakerAudioUrl) {
      URL.revokeObjectURL(speakerAudioUrl);
      setSpeakerAudioUrl(null);
      setSpeakerAudioBlob(null);
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
      cleanupSpeaker();
    };
  }, []);

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '50px auto', 
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '10px',
      textAlign: 'center'
    }}>
      <h1>音频录制应用</h1>
      
      {/* 麦克风录音部分 */}
      <div style={{ 
        marginBottom: '40px',
        padding: '20px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px'
      }}>
        <h2>🎤 麦克风录音</h2>
        
        <div style={{ margin: '20px 0' }}>
          <button 
            onClick={startRecording} 
            disabled={isRecording}
            style={{
              padding: '10px 20px',
              margin: '0 10px',
              backgroundColor: isRecording ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            {isRecording ? '录音中...' : '开始录音'}
          </button>
          
          <button 
            onClick={stopRecording} 
            disabled={!isRecording}
            style={{
              padding: '10px 20px',
              margin: '0 10px',
              backgroundColor: !isRecording ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: !isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            停止录音
          </button>
        </div>

        {/* 麦克风录音播放和下载区域 */}
        {audioUrl && (
          <div style={{ 
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '5px'
          }}>
            <h3>麦克风录音预览</h3>
            
            <audio 
              controls 
              src={audioUrl}
              style={{ width: '100%', margin: '15px 0' }}
            >
              你的浏览器不支持音频播放
            </audio>
            
            <div style={{ marginTop: '15px' }}>
              <button 
                onClick={downloadAudio}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                📥 下载麦克风录音
              </button>
              
              <button 
                onClick={cleanup}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🗑️ 清除录音
              </button>
            </div>
            
            {audioBlob && (
              <p style={{ 
                marginTop: '10px', 
                fontSize: '14px', 
                color: '#666' 
              }}>
                文件大小: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB | 
                格式: {audioBlob.type || 'audio/webm'}
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* 扬声器录音部分 */}
      <div style={{ 
        padding: '20px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px'
      }}>
        <h2>🔊 扬声器录音（系统音频）</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          注意：此功能会要求您选择要录制音频的标签页或窗口
        </p>
        
        <div style={{ margin: '20px 0' }}>
          <button 
            onClick={startRecordingSpeaker} 
            disabled={isRecordingSpeaker}
            style={{
              padding: '10px 20px',
              margin: '0 10px',
              backgroundColor: isRecordingSpeaker ? '#6c757d' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isRecordingSpeaker ? 'not-allowed' : 'pointer'
            }}
          >
            {isRecordingSpeaker ? '录制中...' : '开始录制扬声器'}
          </button>
          
          <button 
            onClick={stopRecordingSpeaker} 
            disabled={!isRecordingSpeaker}
            style={{
              padding: '10px 20px',
              margin: '0 10px',
              backgroundColor: !isRecordingSpeaker ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: !isRecordingSpeaker ? 'not-allowed' : 'pointer'
            }}
          >
            停止录制
          </button>
        </div>

        {/* 扬声器录音播放和下载区域 */}
        {speakerAudioUrl && (
          <div style={{ 
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#e7f3ff',
            borderRadius: '5px'
          }}>
            <h3>扬声器录音预览</h3>
            
            <audio 
              controls 
              src={speakerAudioUrl}
              style={{ width: '100%', margin: '15px 0' }}
            >
              你的浏览器不支持音频播放
            </audio>
            
            <div style={{ marginTop: '15px' }}>
              <button 
                onClick={downloadSpeakerAudio}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                📥 下载扬声器录音
              </button>
              
              <button 
                onClick={cleanupSpeaker}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🗑️ 清除录音
              </button>
            </div>
            
            {speakerAudioBlob && (
              <p style={{ 
                marginTop: '10px', 
                fontSize: '14px', 
                color: '#666' 
              }}>
                文件大小: {(speakerAudioBlob.size / 1024 / 1024).toFixed(2)} MB | 
                格式: {speakerAudioBlob.type || 'audio/webm'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;