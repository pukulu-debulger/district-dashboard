const express = require('express')
require('dotenv').config()

const app = express()
app.use(express.json())

app.use(express.static('.'))

const { router: uploadRouter } = require('./routes/upload')
app.use('/api/upload', uploadRouter)

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'District Dashboard API running' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})