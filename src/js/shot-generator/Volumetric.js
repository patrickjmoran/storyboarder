const THREE = require('three')
window.THREE = window.THREE || THREE

const path = require('path')

const React = require('react')
const { useRef, useEffect, useState } = React

const loadingManager = new THREE.LoadingManager()
const textureLoader = new THREE.TextureLoader()

const IconSprites = require('./IconSprites')

const { isUserFile } = require('../services/model-loader')
const pathToShotGeneratorData = path.join(__dirname, '..', '..', '..', 'src', 'data', 'shot-generator')
const pathToBuiltInVolumeImages = path.join(pathToShotGeneratorData, 'volumes')

const Volumetric = React.memo(({
  scene,
  id,
  type,
  isSelected,
  camera,
  updateObject,
  numberOfLayers,
  distanceBetweenLayers,

  storyboarderFilePath,
  volumeImageAttachmentIds,

  ...props
}) => {

  const volume = useRef(null)

  const loadVolume = (imgArray) => {
    const promises = imgArray.map(link => loadMaterialPromise(link))
    let volContainer = []    
    //console.log('got original: ', originalVolume )
    return Promise.all(promises).then((materials) => {
      for (var i = 0; i < numberOfLayers; i++) {
        let plane = new THREE.PlaneBufferGeometry(1, 1)
        let planeMesh = new THREE.Mesh(plane, materials[i % materials.length])
        planeMesh.material.opacity = props.opacity
        planeMesh.position.z = props.depth / numberOfLayers * (numberOfLayers - 2 * i) / 2 - props.depth / numberOfLayers / 2
        planeMesh.position.y = 1 / 2
        volContainer.push(planeMesh)
  
        planeMesh.layers.disable(0)
        planeMesh.layers.enable(1)
        planeMesh.layers.disable(2)
        planeMesh.layers.enable(3)
      }
  
      return new Promise(resolve => {
        resolve({volContainer, materials})
      })
    })
  }

  const loadMaterialPromise = (link) => {
    return new Promise((resolve, reject) => {
      textureLoader.load(link, (texture) => {
        let c = 0xFF * props.color / 0xFFFFFF
        let color = (c << 16) | (c << 8) | c
        let volumeMaterial = new THREE.MeshBasicMaterial({
          depthWrite: false,
          transparent: true,
          color: new THREE.Color(color),
          opacity: props.opacity,
          alphaMap: texture,
          side: THREE.DoubleSide
        })
        volumeMaterial.userData.outlineParameters = { thickness: 0, alpha: 0.0 }
        resolve(volumeMaterial)
      })
    })
  }

  const cleanup = () => {
    if (volume.current) {
      console.log(type, id, 'remove')

      scene.remove(volume.current.orthoIcon)
      scene.remove(volume.current)
      volume.current = null
    }
  }

  const create = () => {
    return new Promise((resolve, reject) => {
    
      volume.current = new THREE.Object3D()
      volume.current.textureLayers = []

      volume.current.userData.id = id
      volume.current.userData.type = type
      volume.current.orthoIcon = new IconSprites(type, props.name ? props.name : props.displayName, volume.current)
      volume.current.rotation.y = props.rotation

      scene.add(volume.current.orthoIcon)
      scene.add(volume.current)


      console.log('creating volume:  ', props)

      let imgArray = volumeImageAttachmentIds.map(relpath => {
        if (isUserFile(relpath)) {
          return path.join(path.dirname(storyboarderFilePath), relpath)
        } else {
          return path.join(pathToBuiltInVolumeImages, relpath + '.jpg')
        }
      })

      loadVolume(imgArray).then((result) => {
        volume.current.scale.set(props.width, props.height, 1)
        volume.current.position.set(props.x, props.z, props.y)
        volume.current.rotation.y = props.rotation
        volume.current.loadedMaterials = result.materials
        volume.current.textureLayers = result.volContainer
        result.volContainer.map(plane => {
          volume.current.add(plane)
        })
        volume.current.orthoIcon.position.copy(volume.current.position)
        resolve(volume.current)
      })
    })
  }

  useEffect(() => {
    create().then((result) => {
      return cleanup
    })

    
  }, [])

  useEffect(() => {
    if (volume.current !== null) {
      volume.current.position.x = props.x
      volume.current.position.z = props.y
      volume.current.position.y = props.z

      volume.current.rotation.y = props.rotation
      volume.current.orthoIcon.position.copy(volume.current.position)

    }
  }, [props.x, props.y, props.z, props.rotation, props.scale])

  useEffect(() => {
    if (volume.current !== null) {
      let intLay = parseInt(numberOfLayers)
      volume.current.scale.set(props.width, props.height, 1)
      for (var i = 0; i < volume.current.textureLayers.length; i++) {
        let plane = volume.current.textureLayers[i]
        plane.position.z = props.depth / intLay * (intLay - 2 * i) / 2 - props.depth / numberOfLayers / 2
      }
    }
  }, [props.width, props.height, props.depth, numberOfLayers])

  useEffect(() => {
    if (numberOfLayers % 1 != 0) return
    let intLay = parseInt(numberOfLayers)

    if (volume.current !== null && volume.current.children.length > 0) {
      while (volume.current.children.length > 0) {
        volume.current.remove(volume.current.children[0])
      }

      volume.current.textureLayers = []
      for (let i = 0; i < intLay; i++) {
        let plane = new THREE.PlaneBufferGeometry(1, 1)
        let planeMesh = new THREE.Mesh(plane, volume.current.loadedMaterials[i % volume.current.loadedMaterials.length])
        planeMesh.position.z = props.depth / intLay * (intLay - 2 * i) / 2 - props.depth / numberOfLayers / 2
        planeMesh.position.y = 1 / 2
        volume.current.add(planeMesh)
        volume.current.textureLayers.push(planeMesh)

        planeMesh.layers.disable(0)
        planeMesh.layers.enable(1)
        planeMesh.layers.disable(2)
        planeMesh.layers.enable(3)
      }
    }

  }, [numberOfLayers])

  useEffect(() => {
    if (volume.current && volume.current.loadedMaterials) {
      let c = 0xFF * props.color / 0xFFFFFF
      let color = (c << 16) | (c << 8) | c
      for (var i = 0; i < volume.current.loadedMaterials.length; i++) {
        volume.current.loadedMaterials[i].opacity = props.opacity
        volume.current.loadedMaterials[i].color = new THREE.Color(color)
        volume.current.loadedMaterials[i].needsUpdate = true
      }
    }
  }, [props.opacity, props.color])

  useEffect(() => {
    if (volume.current) {
      scene.remove(volume.current.orthoIcon)
      scene.remove(volume.current)
      volume.current = null

      console.log('creating volume: ', volumeImageAttachmentIds)
      create()
    }

  }, [volumeImageAttachmentIds])

  return null
})

module.exports = Volumetric
