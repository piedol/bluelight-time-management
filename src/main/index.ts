import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createObjectCsvWriter } from 'csv-writer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
ipcMain.on('downloadStateData', (event, stateData) => {
  /* Output of the file should have the headers: fname, lname, sessionid, logintime, logouttime  */
  let restructuredData: any = []
  for (let i = 0; i < stateData.length; i++) {
    let currentUser = stateData[i]
    for (let j = 0; j < currentUser['Session'].length; j++) {
      let currentSession = currentUser['Session'][j]
      restructuredData.push({
        id: currentUser.id,
        fname: currentUser.fname,
        lname: currentUser.lname,
        sessionId: currentSession.id,
        loginTime: currentSession.loginTime,
        logoutTime: currentSession.logoutTime
      })
    }
  }
  const csvWriter = createObjectCsvWriter({
    path: 'output.csv',
    header: [
      { id: 'id', title: 'ID' },
      { id: 'fname', title: 'First Name' },
      { id: 'lname', title: 'Last Name' },
      { id: 'sessionId', title: 'Session ID' },
      { id: 'loginTime', title: 'Login Time' },
      { id: 'logoutTime', title: 'Logout Time' }
    ]
  })
  csvWriter
    .writeRecords(restructuredData)
    .then(() => {
      console.log('Successfully created CSV')
    })
    .catch((error) => {
      console.error('Error Writing File: ', error)
    })
  console.log('Current Sessions: ', stateData)
})

const checkIfCursorHasMoved = (mousePoint) => {
  let newCursorPoint = getCursorPoint()
  if (newCursorPoint.x === mousePoint.x && newCursorPoint.y === mousePoint.y) {
    return false
  } else {
    return true
  }
}

ipcMain.on('user-status-changed', (event, status) => {
  console.log(status)
  let currentCursorPoint = getCursorPoint()
  let myInterval
  if (!status) {
    myInterval = setInterval(() => {
      console.log(currentCursorPoint)
      if (checkIfCursorHasMoved(currentCursorPoint)) {
        currentCursorPoint = getCursorPoint()
      } else {
        event.sender.send('event-response', false)
        clearInterval(myInterval)
      }
    }, 10000)
  } else {
    clearInterval(myInterval)
  }
})

function getCursorPoint(): { x: number; y: number } {
  let newCursorPoint = {
    x: screen.getCursorScreenPoint().x,
    y: screen.getCursorScreenPoint().y
  }
  return newCursorPoint
}
