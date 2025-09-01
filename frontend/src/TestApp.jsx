import React from 'react'

function TestApp() {
  return (
    <div style={{ 
      backgroundColor: '#0a0e27', 
      color: 'white', 
      minHeight: '100vh', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#00d4ff' }}>React is Working!</h1>
      <p>If you can see this, React is mounting correctly.</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
      <button 
        onClick={() => alert('Button clicked!')}
        style={{
          backgroundColor: '#00d4ff',
          color: 'black',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '20px'
        }}
      >
        Test Button
      </button>
    </div>
  )
}

export default TestApp
