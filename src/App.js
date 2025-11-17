import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  // 麦克风录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [speakerAudioUrl, setSpeakerAudioUrl] = useState(null);
  const [speakerAudioBlob, setSpeakerAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const [isHttps, setIsHttps] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState('unknown');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speakerMediaRecorderRef = useRef(null);
  const speakerAudioChunksRef = useRef([]);

  const destinationRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);

  // 检查是否为HTTPS环境
  useEffect(() => {
    const checkHttps = () => {
      const isSecureContext = window.isSecureContext;
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
      const isHttpsProtocol = window.location.protocol === 'https:';
      
      setIsHttps(isSecureContext || isLocalhost || isHttpsProtocol);
    };

    checkHttps();
  }, []);

  // 检查麦克风权限
  const checkMicrophonePermission = async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      setMicrophonePermission('unsupported');
      return 'unsupported';
    }

    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      setMicrophonePermission(result.state);
      return result.state;
    } catch (error) {
      console.warn('无法检查麦克风权限:', error);
      setMicrophonePermission('unknown');
      return 'unknown';
    }
  };

  // 获取详细的错误信息
  const getErrorMessage = (error) => {
    if (!isHttps) {
      return {
        title: '需要安全连接',
        message: '麦克风访问需要在HTTPS安全环境下进行。请使用以下方法之一：\n\n1. 使用HTTPS访问此页面\n2. 在本地开发环境使用 localhost\n3. 运行 npm run start:https 启动开发服务器',
        solution: '请刷新页面或重新启动开发服务器'
      };
    }

    if (error.name === 'NotAllowedError') {
      return {
        title: '麦克风权限被拒绝',
        message: '浏览器拒绝了麦克风访问权限。请在浏览器设置中允许麦克风访问，然后刷新页面。',
        solution: '请在浏览器地址栏左侧点击摄像头图标，允许麦克风访问'
      };
    }

    if (error.name === 'NotFoundError') {
      return {
        title: '未找到麦克风设备',
        message: '系统未检测到麦克风设备。请确保麦克风已正确连接并被系统识别。',
        solution: '请检查麦克风连接，或在系统设置中启用麦克风'
      };
    }

    if (error.name === 'NotReadableError') {
      return {
        title: '麦克风被占用',
        message: '麦克风可能被其他应用程序占用。请关闭其他可能使用麦克风的程序。',
        solution: '请关闭其他录音软件或通讯软件，然后重试'
      };
    }

    return {
      title: '麦克风访问失败',
      message: `发生未知错误: ${error.message}`,
      solution: '请检查浏览器控制台获取详细信息，或尝试刷新页面'
    };
  };

  const startRecording = async () => {
    // 先检查HTTPS环境
    if (!isHttps) {
      const errorInfo = getErrorMessage({ name: 'InsecureContext' });
      setError(errorInfo);
      return;
    }

    // 检查权限
    const permission = await checkMicrophonePermission();
    if (permission === 'denied') {
      const errorInfo = getErrorMessage({ name: 'NotAllowedError' });
      setError(errorInfo);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          // 提高采样率到48kHz，更适合现代音频处理
          sampleRate: 48000,
          // 使用立体声录制
          channelCount: 2,
          // 提高音频位深度
          sampleSize: 24,
          // 保持音频处理功能
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // 添加额外的质量参数
          latency: 0.01, // 低延迟
          volume: 1.0    // 最大音量
        } 
      });
      
      // 检测支持的MIME类型
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('浏览器不支持任何音频格式');
      }
      
      // 优化MediaRecorder配置
      const options = { 
        mimeType: selectedMimeType,
        // 设置高比特率以提高音质
        audioBitsPerSecond: 256000, // 256 kbps，高质量音频
        videoBitsPerSecond: 0 // 只录制音频
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
        setError(null);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingType('microphone');
      
    } catch (error) {
      console.error('麦克风录音启动失败:', error);
      const errorInfo = getErrorMessage(error);
      setError(errorInfo);
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
        audio: {
          // 设置高质量音频参数
          sampleRate: 48000,
          channelCount: 2,
          sampleSize: 24,
          latency: 0.01,
          volume: 1.0,
          // 禁用自动处理以保持原始音质
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: true
      });
      
      // 创建音频上下文来处理音频流，设置高质量
      audioContextRef.current = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive',
        // 使用最佳音频质量
        sinkId: 'default'
      });
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(displayStream);
      destinationRef.current = audioContextRef.current.createMediaStreamDestination();
      
      // 连接源到目标
      sourceRef.current.connect(destinationRef.current);
      
      // 创建 MediaRecorder 来录制目标流
      const options = { 
        mimeType: 'audio/webm;codecs=opus',
        // 设置高比特率以提高音质
        audioBitsPerSecond: 256000 // 256 kbps，高质量音频
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
        
        // 清理音频上下文
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        
        displayStream.getTracks().forEach(track => track.stop());
      };

      // 监听屏幕共享结束事件
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopRecordingSpeaker();
      });

      displayStream.getAudioTracks()[0]?.addEventListener('ended', () => {
        stopRecordingSpeaker();
      });

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingType('speaker');
      
    } catch (error) {
      console.error('扬声器录音启动失败:', error);
      alert('无法录制系统音频，请确保您选择了共享音频');
    }
  };

  // 停止扬声器录音
  const stopRecordingSpeaker = () => {
    if (speakerMediaRecorderRef.current && isRecording && recordingType === 'speaker') {
      speakerMediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingType(null);
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

  // 清除错误信息
  const clearError = () => {
    setError(null);
  };

  // 重新请求权限
  const requestPermissionAgain = async () => {
    clearError();
    await startRecording();
  };

  // 获取权限状态显示文本
  const getPermissionStatusText = () => {
    switch (microphonePermission) {
      case 'granted':
        return '✅ 麦克风权限已授予';
      case 'denied':
        return '❌ 麦克风权限被拒绝';
      case 'prompt':
        return '⚠️ 需要请求麦克风权限';
      case 'unsupported':
        return '⚠️ 浏览器不支持权限检查';
      default:
        return '❓ 权限状态未知';
    }
  };

  // 获取连接状态显示文本
  const getConnectionStatusText = () => {
    if (isHttps) {
      return '✅ 安全连接已建立';
    } else {
      return '❌ 需要安全连接（HTTPS）';
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
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>🎤 音频录制演示</h1>
      
      {/* 状态显示 */}
      <div style={{ 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>系统状态</h3>
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <div>{getConnectionStatusText()}</div>
          <div>{getPermissionStatusText()}</div>
          {!isHttps && (
            <div style={{ 
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              color: '#856404'
            }}>
              <strong>💡 提示：</strong> 
              运行 <code style={{ background: '#f8f9fa', padding: '2px 4px', borderRadius: '3px' }}>
              npm run start:https</code> 启动HTTPS开发服务器
            </div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{ 
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          color: '#721c24'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#721c24' }}>
                ⚠️ {error.title}
              </h4>
              <p style={{ margin: '0 0 10px 0', whiteSpace: 'pre-line' }}>
                {error.message}
              </p>
              <p style={{ margin: '0', fontWeight: 'bold' }}>
                🔧 解决方案：{error.solution}
              </p>
            </div>
            <button 
              onClick={clearError}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#721c24',
                padding: '0',
                marginLeft: '10px'
              }}
            >
              ✕
            </button>
          </div>
          {error.title.includes('权限') && (
            <div style={{ marginTop: '15px' }}>
              <button 
                onClick={requestPermissionAgain}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                🔄 重新请求权限
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* 麦克风录音部分 */}
      <div style={{ 
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: '#495057' }}>🎤 麦克风录音</h2>
        
        <div style={{ marginBottom: '15px' }}>
          {isRecording && recordingType === 'microphone' ? (
            <button 
              onClick={stopRecording}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                cursor: 'pointer',
                marginRight: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ⏹️ 停止录音
            </button>
          ) : (
            <button 
              onClick={startRecording}
              disabled={!isHttps}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: isHttps ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                cursor: isHttps ? 'pointer' : 'not-allowed',
                marginRight: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🎤 开始录音
            </button>
          )}
          
          {isRecording && recordingType === 'microphone' && (
            <span style={{ 
              color: '#dc3545',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              🔴 正在录音...
            </span>
          )}
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
            disabled={isRecording && recordingType === 'speaker'}
            style={{
              padding: '10px 20px',
              margin: '0 10px',
              backgroundColor: isRecording && recordingType === 'speaker' ? '#6c757d' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isRecording && recordingType === 'speaker' ? 'not-allowed' : 'pointer'
            }}
          >
            {isRecording && recordingType === 'speaker' ? '录制中...' : '开始录制扬声器'}
          </button>
          
          <button 
            onClick={stopRecordingSpeaker} 
            disabled={!isRecording || recordingType !== 'speaker'}
            style={{
              padding: '10px 20px',
              margin: '0 10px',
              backgroundColor: !isRecording || recordingType !== 'speaker' ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: !isRecording || recordingType !== 'speaker' ? 'not-allowed' : 'pointer'
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
        {isRecording && recordingType === 'speaker' && (
          <span style={{ 
            color: '#17a2b8',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            🔴 正在录制扬声器...
          </span>
        )}
      </div>
    </div>
  );
};

export default App;