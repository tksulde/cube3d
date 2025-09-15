'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return <div>Something went wrong. Please try refreshing the page.</div>
  }

  return (
    <React.Fragment>
      {React.Children.map(children, (child) =>
        React.cloneElement(child as React.ReactElement, {
          onError: () => setHasError(true),
        })
      )}
    </React.Fragment>
  )
}

export default function Component() {
  return (
    <ErrorBoundary>
      <CubeGrid />
    </ErrorBoundary>
  )
}

function CubeGrid() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const rowsRef = useRef<THREE.Group[]>([])
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    if (!mountRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    rendererRef.current = renderer
    renderer.setSize(window.innerWidth, window.innerHeight)
    mountRef.current.appendChild(renderer.domElement)

    // Create a group to hold all cubes
    const group = new THREE.Group()
    groupRef.current = group
    scene.add(group)

    // Create 3x3x3 grid of cubes
    const cubeSize = 0.8
    const gap = 0.1
    const gridSize = 3
    const offset = (cubeSize + gap) * (gridSize - 1) / 2

    // Define colors
    const cubeFaceColor = 0x111111 // Dark gray for cube faces
    const cubeOutlineColor = 0x444444 // Lighter gray for outline

    for (let y = 0; y < gridSize; y++) {
      const row = new THREE.Group()
      for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
          const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)
          const edges = new THREE.EdgesGeometry(geometry)
          const material = new THREE.MeshPhongMaterial({
            color: cubeFaceColor,
            shininess: 100,
            specular: 0xffffff
          })
          const cube = new THREE.Mesh(geometry, material)
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: cubeOutlineColor })
          )
          
          cube.position.set(
            x * (cubeSize + gap) - offset,
            0,
            z * (cubeSize + gap) - offset
          )
          line.position.copy(cube.position)
          
          row.add(cube)
          row.add(line)
        }
      }
      row.position.y = y * (cubeSize + gap) - offset
      rowsRef.current.push(row)
      group.add(row)
    }

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
    scene.add(ambientLight)

    // Strong white top light
    const topLight = new THREE.DirectionalLight(0xffffff, 1.5)
    topLight.position.set(0, 10, 0)
    topLight.target.position.set(0, 0, 0)
    scene.add(topLight)
    scene.add(topLight.target)

    // Subtle fill lights
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight1.position.set(5, -2, 5)
    scene.add(fillLight1)

    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight2.position.set(-5, -2, -5)
    scene.add(fillLight2)

    camera.position.set(6, 6, 6)
    camera.lookAt(scene.position)

    // Rotation variables
    let isDragging = false
    let previousMousePosition = { x: 0, y: 0 }
    const dragRotationSpeed = 0.01
    const wholeCubeRotationSpeed = 0.005

    // Timed rotation variables
    const rotationDuration = 1000 // ms
    const pauseDuration = 3000 // ms
    let isRotating = false
    let currentRowIndex = 0
    let rotationStartTime = 0

    // Zoom variables
    let zoomSpeed = 0.1
    let minZoom = 3
    let maxZoom = 20
    let targetZoom = camera.position.length()
    let currentZoom = targetZoom

    // Raycaster for hover detection
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // Interaction handlers
    const startDragging = (clientX: number, clientY: number) => {
      isDragging = true
      previousMousePosition = { x: clientX, y: clientY }
    }

    const stopDragging = () => {
      isDragging = false
    }

    const drag = (clientX: number, clientY: number) => {
      if (isDragging) {
        const deltaMove = {
          x: clientX - previousMousePosition.x,
          y: clientY - previousMousePosition.y
        }

        const deltaRotationQuaternion = new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(
            deltaMove.y * dragRotationSpeed,
            deltaMove.x * dragRotationSpeed,
            0,
            'XYZ'
          ))

        group.quaternion.multiplyQuaternions(deltaRotationQuaternion, group.quaternion)

        previousMousePosition = { x: clientX, y: clientY }
      }
    }

    const checkHover = (clientX: number, clientY: number) => {
      mouse.x = (clientX / window.innerWidth) * 2 - 1
      mouse.y = -(clientY / window.innerHeight) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(group.children, true)
      setIsHovering(intersects.length > 0)
    }

    const zoom = (delta: number) => {
      targetZoom += delta * zoomSpeed
      targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom))
    }

    // Mouse event handlers
    const onMouseDown = (event: MouseEvent) => startDragging(event.clientX, event.clientY)
    const onMouseMove = (event: MouseEvent) => {
      checkHover(event.clientX, event.clientY)
      drag(event.clientX, event.clientY)
    }
    const onMouseUp = stopDragging
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoom(event.deltaY)
    }

    // Touch event handlers
    let previousTouchDistance = 0
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault()
        startDragging(event.touches[0].clientX, event.touches[0].clientY)
      } else if (event.touches.length === 2) {
        previousTouchDistance = Math.hypot(
          event.touches[0].pageX - event.touches[1].pageX,
          event.touches[0].pageY - event.touches[1].pageY
        )
      }
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault()
        drag(event.touches[0].clientX, event.touches[0].clientY)
      } else if (event.touches.length === 2) {
        const touchDistance = Math.hypot(
          event.touches[0].pageX - event.touches[1].pageX,
          event.touches[0].pageY - event.touches[1].pageY
        )
        zoom(previousTouchDistance - touchDistance)
        previousTouchDistance = touchDistance
      }
    }
    const onTouchEnd = stopDragging

    // Add event listeners
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    // Animation loop
    const animate = (time: number) => {
      if (sceneRef.current && rendererRef.current && groupRef.current && cameraRef.current) {
        requestAnimationFrame(animate)

        // Whole cube auto-rotation
        if (!isDragging) {
          group.rotation.x += wholeCubeRotationSpeed
          group.rotation.y += wholeCubeRotationSpeed
        }

        // Timed row rotation
        if (!isRotating && time - rotationStartTime > pauseDuration) {
          isRotating = true
          rotationStartTime = time
        }

        if (isRotating) {
          const progress = (time - rotationStartTime) / rotationDuration
          if (progress < 1) {
            const angle = progress * Math.PI / 2 // 90 degrees
            rowsRef.current[currentRowIndex].rotation.y = angle
          } else {
            rowsRef.current[currentRowIndex].rotation.y = Math.PI / 2
            isRotating = false
            currentRowIndex = (currentRowIndex + 1) % rowsRef.current.length
            rotationStartTime = time
          }
        }

        // Smooth zoom
        currentZoom += (targetZoom - currentZoom) * 0.1
        const direction = new THREE.Vector3().subVectors(camera.position, scene.position).normalize()
        camera.position.copy(direction.multiplyScalar(currentZoom))
        camera.lookAt(scene.position)

        rendererRef.current.render(sceneRef.current, camera)
      }
    }
    animate(0)

    // Handle window resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        const { innerWidth, innerHeight } = window
        cameraRef.current.aspect = innerWidth / innerHeight
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(innerWidth, innerHeight)
      }
    }
    window.addEventListener('resize', handleResize)

    // Cleanup function
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', handleResize)
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
    }
  }, [])

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: '100%', 
        height: '100vh',
        cursor: isHovering ? 'grab' : 'default',
        touchAction: 'none'
      }} 
    />
  )
}
