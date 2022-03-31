#!/usr/bin/env node

const chalk = require('chalk')
const ora = require('ora')
const inquirer = require('inquirer')

const puppeteer = require('puppeteer')
const ytdl = require('ytdl-core')
const superagent = require('superagent')

const fs = require('fs')
const https = require('https')
const path = require('path')

const orange = '#ed9e4e'
const purple = '#ab55f2'

function handleError(error) {
  console.log([
    chalk.bgRed.white('Error!'),
    chalk.red(error)
  ].join`\n`)
  process.exit(1)
}

function hexToRGB(hex) {
  return [
    parseInt(hex.slice(1).substring(0, 2), 16),
    parseInt(hex.slice(1).substring(2, 4), 16),
    parseInt(hex.slice(1).substring(4, 6), 16)
  ]
}

function lerp(start, end, index) {
  return [
    Math.round(start[0] + (end[0] - start[0]) * index),
    Math.round(start[1] + (end[1] - start[1]) * index),
    Math.round(start[2] + (end[2] - start[2]) * index)
  ]
}

function linearGradient(start, end, length) {
  return Array.from({ length }).map((_, index) => {
    return lerp(hexToRGB(start), hexToRGB(end), index / length)
  })
}

function textGradient(text) {
  const colorArray = linearGradient(orange, purple, text.length)
  return colorArray.map((color, index) => {
    return chalk.rgb(
      color[0],
      color[1],
      color[2]
    )(text.charAt(index))
  }).join``
}

async function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

console.typeGradient = async (text, ms = 20) => {
  const colorArray = linearGradient(orange, purple, text.length)
  const characterArray = colorArray.map((color, index) => {
    return chalk.rgb(
      color[0],
      color[1],
      color[2]
    )(text.charAt(index))
  })

  let index = 0

  async function loop() {
    if (index < text.length) {
      process.stdout.write(characterArray[index])
      await delay(ms)

      index++
      return loop()
    }
    return process.stdout.write('\n')
  }

  await loop()
}

async function start() {
  console.clear()
  await console.typeGradient('Welcome to joojdev\'s Youtube CLI!')
  await console.typeGradient('Here you can search and download Youtube videos!')

  inquirer
    .prompt([
      {
        name: 'direction',
        message: textGradient('What do you want?'),
        type: 'list',
        choices: [
          'Search and download a video',
          'Just download'
        ]
      }
    ])
    .then(({ direction }) => {
      if (direction == 'Just download') {
        justDownloadSection()
      } else {
        searchAndDownloadSection()
      }
    })
    .catch((error) => handleError(error))
}

async function justDownloadSection() {
  console.clear()
  await console.typeGradient('First, you need to insert the video ID.')

  inquirer
    .prompt([
      {
        name: 'videoId',
        type: 'input',
        message: textGradient('What is the video ID?'),
        default: 'dQw4w9WgXcQ'
      }
    ])
    .then(({ videoId }) => {
      downloadSection(videoId)
    })
    .catch((error) => handleError(error))
}

async function searchVideoByName(name) {
  const url = `https://www.youtube.com/results?search_query=${name.trim().split(/ +/).join`+`}`
  const loadingSpinner = ora()

  let videoArray = null

  try {
    loadingSpinner.color = 'magenta'
    loadingSpinner.start('Opening browser...')
    const browser = await puppeteer.launch({ headless: true })
    loadingSpinner.succeed('Browser was opened!')
  
    loadingSpinner.render().start('Opening Youtube...')
    const allPages = await browser.pages()
    const page = allPages[0]
    await page.setViewport({ width: 1600, height: 900 })
    await page.goto(url, {
      waitUntil: 'networkidle0'
    })
    loadingSpinner.succeed('Youtube was opened!')

    loadingSpinner.render().start('Scraping the data...')
    videoArray = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a#video-title')).map((element) => {
        const name = element.innerText
        const url = element.href
        const id = url.split('watch?v=')[1]
        const title = `${name} (${id})`
      
        return {
          name,
          url,
          id,
          title
        }
      })
    })
    loadingSpinner.succeed('Scraped the data!')

    loadingSpinner.render().start('Closing browser!')
    await browser.close()
    loadingSpinner.succeed('Browser was closed!')
  } catch (error) {
    loadingSpinner.fail('Error!')
    handleError(error)
    process.exit(1)
  }

  return videoArray
}

async function searchAndDownloadSection() {
  console.clear()
  await console.typeGradient('First, you need to search the video!')

  inquirer
    .prompt([
      {
        name: 'name',
        type: 'input',
        message: textGradient('What do you want to search?'),
        default: 'Never Gonna Give You Up'
      }
    ])
    .then(async ({ name }) => {
      const videoArray = await searchVideoByName(name)
      selectVideoSection(videoArray)
    })
    .catch((error) => handleError(error))
}

async function selectVideoSection(videoArray) {
  console.clear()
  await console.typeGradient('Now, you need to select a video to download.')

  inquirer
    .prompt([
      {
        name: 'video',
        type: 'list',
        message: textGradient('What video do you want to download?'),
        choices: videoArray.map((videoDetails) => videoDetails.title)
      }
    ])
    .then(({ video }) => {
      const selectedVideo = videoArray.find((videoDetails) => videoDetails.title == video)
      downloadSection(selectedVideo.id)
    })
    .catch((error) => handleError(error))
}

async function downloadSection(videoId) {
  console.clear()
  await console.typeGradient('Now, we are going to get the video formats.')

  const loadingSpinner = ora()
  loadingSpinner.color = 'magenta'

  loadingSpinner.start('Getting video formats...')
  const videoInfo = await ytdl.getInfo(videoId)
  loadingSpinner.succeed('Got video formats!')
  const videoFormats = videoInfo.formats.filter((videoFormat) => videoFormat.hasAudio).map(({ url, mimeType, qualityLabel, audioBitrate, container }) => {
    return {
      url,
      tag: [
        mimeType,
        `${audioBitrate}bps`,
        qualityLabel || undefined
      ].filter((_) => !!_).join(' '),
      extension: container,
      title: videoInfo.videoDetails.title
    }
  })

  inquirer
    .prompt([
      {
        name: 'formatTag',
        type: 'list',
        message: textGradient('What format is better for you?'),
        choices: videoFormats.map((videoFormat) => videoFormat.tag)
      }
    ])
    .then(({ formatTag }) => {
      const selectedFormat = videoFormats.find((videoFormat) => videoFormat.tag == formatTag)
      
      inquirer
      .prompt([
          {
            name: 'fileName',
            type: 'input',
            message: textGradient('What do you want to call your file?'),
            default: selectedFormat.title
          }
        ])
        .then(({ fileName }) => {
          const fileDestiny = path.join(process.cwd(), `${fileName.trim().replace(/[\\/:*?\"<>|]/g,"").substring(0, 240)}.${selectedFormat.extension}`)
          
          function calculateProgressPercentage(bytesDownloaded, fileSize) {
            return Math.floor((bytesDownloaded / fileSize * 100))
          }
          
          let bytesDownloaded = 0
          loadingSpinner.render().start('Downloading video... Progress: 0%')
          const file = fs.createWriteStream(fileDestiny)
          https.get(selectedFormat.url, (response) => {
            const fileSize = Number(response.headers['content-length'])
            
            process.on('SIGINT', () => {
              loadingSpinner.fail('Cancelled!')
              fs.unlink(fileDestiny, () => process.exit())
            })

            response.on('data', (data => {
              file.write(data)

              bytesDownloaded += Buffer.byteLength(data)
              loadingSpinner.text = `Downloading video... Progress: ${calculateProgressPercentage(bytesDownloaded, fileSize)}%`
            }))
            
            response.on('end', () => {
              file.close()
              loadingSpinner.succeed('Downloaded video!')
            })
          }).on('error', (error) => {
            loadingSpinner.fail('Error!')
            fs.unlink(fileDestiny, () => {})
            handleError(error)
          })

        })
        .catch((error) => handleError(error))
    })
    .catch((error) => handleError(error))
}

start()