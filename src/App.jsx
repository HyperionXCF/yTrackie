import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [courses, setCourses] = useState([])
  const [view, setView] = useState('home')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [playlistInfo, setPlaylistInfo] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadCourses()
    loadApiKey()
  }, [])

  const loadCourses = () => {
    chrome.storage.local.get(['courses'], (result) => {
      setCourses(result.courses || [])
    })
  }

  const loadApiKey = () => {
    chrome.storage.local.get(['youtubeApiKey'], (result) => {
      if (result.youtubeApiKey) {
        setApiKey(result.youtubeApiKey)
      }
    })
  }

  const saveApiKey = () => {
    if (apiKey.trim()) {
      chrome.storage.local.set({ youtubeApiKey: apiKey.trim() })
      setShowSettings(false)
      setMessage({ type: 'success', text: 'API key saved!' })
      setTimeout(() => setMessage(null), 2000)
    }
  }

  const parsePlaylistUrl = (url) => {
    try {
      const urlObj = new URL(url)
      if (!urlObj.hostname.includes('youtube.com') && !urlObj.hostname.includes('youtu.be')) {
        return null
      }
      const playlistId = urlObj.searchParams.get('list')
      return playlistId
    } catch {
      return null
    }
  }

  const fetchPlaylistInfo = async () => {
    const playlistId = parsePlaylistUrl(playlistUrl)
    
    if (!playlistId) {
      setMessage({ type: 'error', text: 'Invalid YouTube playlist URL' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    if (!apiKey) {
      setMessage({ type: 'error', text: 'Please add your YouTube API key in settings' })
      setTimeout(() => setMessage(null), 3000)
      setShowSettings(true)
      return
    }

    setLoading(true)
    
    try {
      // First, get playlist details
      const playlistResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`
      )
      const playlistData = await playlistResponse.json()
      
      if (!playlistData.items || playlistData.items.length === 0) {
        throw new Error('Playlist not found')
      }

      const playlistTitle = playlistData.items[0].snippet.title
      let allVideos = []
      let nextPageToken = ''

      // Fetch all videos from playlist (paginated)
      do {
        const videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${apiKey}`
        const videosResponse = await fetch(videosUrl)
        const videosData = await videosResponse.json()

        if (videosData.items) {
          const videoItems = videosData.items.map((item, index) => ({
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
            link: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}&list=${playlistId}`,
            position: item.snippet.position
          }))
          allVideos = [...allVideos, ...videoItems]
        }

        nextPageToken = videosData.nextPageToken || ''
      } while (nextPageToken)

      setPlaylistInfo({
        playlistId,
        title: playlistTitle,
        videoCount: allVideos.length,
        videos: allVideos
      })
      setLoading(false)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Failed to fetch. Check API key or playlist URL.' })
      setTimeout(() => setMessage(null), 3000)
      setLoading(false)
    }
  }

  const addCourse = () => {
    if (!playlistInfo) return
    
    const newCourse = {
      id: Date.now().toString(),
      playlistId: playlistInfo.playlistId,
      title: playlistInfo.title,
      videoCount: playlistInfo.videoCount,
      videos: playlistInfo.videos || [],
      completedVideos: [],
      dateAdded: new Date().toISOString(),
      targetDate: null
    }
    
    const updatedCourses = [...courses, newCourse]
    setCourses(updatedCourses)
    chrome.storage.local.set({ courses: updatedCourses })
    setPlaylistInfo(null)
    setPlaylistUrl('')
    setView('home')
  }

  const removeCourse = (id) => {
    const updatedCourses = courses.filter(c => c.id !== id)
    setCourses(updatedCourses)
    chrome.storage.local.set({ courses: updatedCourses })
  }

  const updateTargetDate = (courseId, targetDate) => {
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        return { ...c, targetDate }
      }
      return c
    })
    setCourses(updatedCourses)
    chrome.storage.local.set({ courses: updatedCourses })
  }

  const toggleVideoComplete = (courseId, videoId) => {
    const updatedCourses = courses.map(c => {
      if (c.id === courseId) {
        const completed = c.completedVideos || []
        if (completed.includes(videoId)) {
          return { ...c, completedVideos: completed.filter(v => v !== videoId) }
        } else {
          return { ...c, completedVideos: [...completed, videoId] }
        }
      }
      return c
    })
    setCourses(updatedCourses)
    chrome.storage.local.set({ courses: updatedCourses })
    
    if (selectedCourse && selectedCourse.id === courseId) {
      const updated = updatedCourses.find(c => c.id === courseId)
      setSelectedCourse(updated)
    }
  }

  const getProgress = (course) => {
    const total = course.videoCount || course.videos?.length || 0
    const completed = course.completedVideos?.length || 0
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  const getDaysRemaining = (targetDate) => {
    if (!targetDate) return null
    const target = new Date(targetDate)
    const today = new Date()
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const openCourse = (course) => {
    setSelectedCourse(course)
    setView('detail')
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="app">
      {message && (
        <div className={`toast ${message.type}`}>
          {message.text}
        </div>
      )}
      
      {view === 'home' && (
        <>
          <header className="header">
            <div className="header-content">
              <h1>yTrackie</h1>
              <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>settings</button>
            </div>
          </header>

          {showSettings && (
            <div className="settings-panel">
              <h3>YouTube API Key</h3>
              <p className="settings-hint">Get a free API key from Google Cloud Console</p>
              <input
                type="text"
                className="api-input"
                placeholder="Paste your API key here"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button className="save-btn" onClick={saveApiKey}>Save</button>
            </div>
          )}

          <nav className="tabs">
            <button className="active">My Courses</button>
            <button onClick={() => { setPlaylistInfo(null); setPlaylistUrl(''); setView('add') }}>+ Add Course</button>
          </nav>

          <main className="content">
            {!apiKey && courses.length === 0 && (
              <div className="setup-notice">
                <p>Welcome! To get started:</p>
                <ol>
                  <li>Get a free YouTube Data API key from Google Cloud</li>
                  <li>Click the settings icon and paste your API key</li>
                  <li>Add your first playlist course</li>
                </ol>
                <button className="setup-btn" onClick={() => setShowSettings(true)}>Add API Key</button>
              </div>
            )}
            
            {courses.length === 0 && apiKey ? (
              <div className="empty">
                <p>No courses yet!</p>
                <button onClick={() => setView('add')}>Add your first course</button>
              </div>
            ) : (
              <div className="course-list">
                {courses.map(course => {
                  const progress = getProgress(course)
                  const daysLeft = getDaysRemaining(course.targetDate)
                  
                  return (
                    <div key={course.id} className="course-card" onClick={() => openCourse(course)}>
                      <div className="course-header">
                        <h3>{course.title}</h3>
                        <button 
                          className="delete-btn" 
                          onClick={(e) => { e.stopPropagation(); removeCourse(course.id) }}
                        >
                          ×
                        </button>
                      </div>
                      
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      
                      <div className="course-stats">
                        <span>{course.completedVideos?.length || 0}/{course.videoCount || course.videos?.length || 0} videos</span>
                        <span className="progress-percent">{progress}%</span>
                      </div>
                      
                      <div className="course-meta">
                        <span className="date-added">Added: {formatDate(course.dateAdded)}</span>
                        
                        {course.targetDate ? (
                          <span className={`target-date ${daysLeft < 0 ? 'overdue' : daysLeft <= 3 ? 'soon' : ''}`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                          </span>
                        ) : (
                          <button 
                            className="set-target-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              const date = prompt('Enter target date (YYYY-MM-DD):')
                              if (date) updateTargetDate(course.id, date)
                            }}
                          >
                            + Set Target
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </main>
        </>
      )}

      {view === 'add' && (
        <>
          <header className="header add-header">
            <button className="back-btn" onClick={() => setView('home')}>back</button>
            <h1>Add Course</h1>
          </header>

          <main className="content">
            {!playlistInfo ? (
              <div className="add-form">
                <p className="hint">Paste a YouTube playlist link below</p>
                <input
                  type="text"
                  className="url-input"
                  placeholder="youtube.com/playlist?list=..."
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchPlaylistInfo()}
                />
                <button 
                  className="fetch-btn" 
                  onClick={fetchPlaylistInfo}
                  disabled={loading || !playlistUrl}
                >
                  {loading ? 'Fetching...' : 'Fetch Playlist'}
                </button>
              </div>
            ) : (
              <div className="preview-form">
                <h2>{playlistInfo.title}</h2>
                <p className="video-count">{playlistInfo.videoCount} videos</p>
                
                {playlistInfo.videos?.length > 0 && (
                  <div className="video-preview">
                    <p>Preview:</p>
                    <div className="video-thumbnails">
                      {playlistInfo.videos.slice(0, 4).map((v, i) => (
                        <div key={i} className="video-thumb">
                          {v.thumbnail && <img src={v.thumbnail} alt="" />}
                        </div>
                      ))}
                      {playlistInfo.videos.length > 4 && <div className="more-videos">+{playlistInfo.videos.length - 4}</div>}
                    </div>
                  </div>
                )}
                
                <div className="actions">
                  <button onClick={addCourse}>Add Course</button>
                  <button className="cancel" onClick={() => { setPlaylistInfo(null); setPlaylistUrl('') }}>Cancel</button>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {view === 'detail' && selectedCourse && (
        <>
          <header className="detail-header">
            <button className="back-btn" onClick={() => setView('home')}>back</button>
            <h1>{selectedCourse.title}</h1>
          </header>

          <div className="detail-stats">
            <div className="stat">
              <span className="stat-value">{getProgress(selectedCourse)}%</span>
              <span className="stat-label">Complete</span>
            </div>
            <div className="stat">
              <span className="stat-value">{selectedCourse.completedVideos?.length || 0}</span>
              <span className="stat-label">Done</span>
            </div>
            <div className="stat">
              <span className="stat-value">{selectedCourse.videoCount || selectedCourse.videos?.length || 0}</span>
              <span className="stat-label">Total</span>
            </div>
          </div>

          <main className="content videos-list">
            {(selectedCourse.videos || []).map((video, index) => {
              const isCompleted = selectedCourse.completedVideos?.includes(video.id)
              
              return (
                <div 
                  key={video.id} 
                  className={`video-item ${isCompleted ? 'completed' : ''}`}
                  onClick={() => toggleVideoComplete(selectedCourse.id, video.id)}
                >
                  <div className="video-checkbox">
                    {isCompleted ? '✓' : ''}
                  </div>
                  <div className="video-thumb">
                    {video.thumbnail && <img src={video.thumbnail} alt="" />}
                  </div>
                  <div className="video-info">
                    <span className="video-number">{index + 1}.</span>
                    <span className="video-title">{video.title}</span>
                  </div>
                </div>
              )
            })}
          </main>
        </>
      )}
    </div>
  )
}

export default App
