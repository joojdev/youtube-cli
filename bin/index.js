#!/usr/bin/env node

import chalk from 'chalk'
import boxen from 'boxen'
import ora from 'ora'
import inquirer from 'inquirer'

import puppeteer from 'puppeteer'

const orange = '#ed9e4e'
const purple = '#ab55f2'

function handleError(error) {
  console.log([
    chalk.bgRed.white('Error!'),
    chalk.red(error)
  ].join`\n`)
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

console.typeGradient = async (text, ms = 50) => {
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
        message: 'What is the video ID?',
        default: 'dQw4w9WgXcQ'
      }
    ])
    .then(({ videoId }) => {
      console.log(videoId)
      // TODO: Make download section.
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
      // TODO: Make download section.
    })
    .catch((error) => handleError(error))
}

start()