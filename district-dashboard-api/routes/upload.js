
const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const pool = require('../db')
const csv = require('csv-parser')
const xlsx = require('xlsx')
const fs = require('fs')

// Multer storage — saves uploaded file to /uploads folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

// Only allow CSV, Excel, and JSON files
const fileFilter = (req, file, cb) => {
  const allowed = ['.csv', '.xlsx', '.xls', '.json']
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowed.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Only CSV, Excel, and JSON files are allowed'), false)
  }
}

const upload = multer({ storage, fileFilter })

//  PARSING FUNCTIONS

// Parse a CSV file — returns array of row objects
function parseCSV(filepath) {
  return new Promise((resolve, reject) => {
    const rows = []
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject)
  })
}

// Parse an Excel file — returns array of row objects
function parseExcel(filepath) {
  const workbook = xlsx.readFile(filepath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = xlsx.utils.sheet_to_json(sheet)
  return rows
}

// Parse a JSON file — returns array of row objects
function parseJSON(filepath) {
  const content = fs.readFileSync(filepath, 'utf8')
  const data = JSON.parse(content)
  return Array.isArray(data) ? data : [data]
}


// TABLE MAP AND UPLOAD ROUTE


const TABLE_MAP = {
  education: 'raw_education',
  health:    'raw_health',
  welfare:   'raw_welfare',
  disaster:  'raw_disaster'
}

// POST /api/upload/:department
router.post('/:department', upload.single('file'), async (req, res) => {
  const { department } = req.params
  const table = TABLE_MAP[department]

  if (!table) {
    return res.status(400).json({
      error: `Unknown department. Use: ${Object.keys(TABLE_MAP).join(', ')}`
    })
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const filepath = req.file.path
  const filename = req.file.originalname
  const ext = path.extname(filename).toLowerCase()

  try {
    let rows = []

    if (ext === '.csv') {
      rows = await parseCSV(filepath)
    } else if (ext === '.xlsx' || ext === '.xls') {
      rows = parseExcel(filepath)
    } else if (ext === '.json') {
      rows = parseJSON(filepath)
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File is empty or could not be parsed' })
    }

    for (const row of rows) {
      await pool.query(
        `INSERT INTO ${table} (data, filename) VALUES ($1, $2)`,
        [JSON.stringify(row), filename]
      )
    }

    fs.unlinkSync(filepath)

    res.status(200).json({
      message: `Successfully uploaded ${rows.length} rows to ${table}`,
      department,
      filename,
      rowsInserted: rows.length
    })

  } catch (err) {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    res.status(500).json({ error: err.message })
  }
})

module.exports = { router, upload }