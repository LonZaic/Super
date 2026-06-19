// Weather API Routes — wttr.in (free, no key, unlimited)
const { Router } = require('express')
const https = require('https')

const router = Router()

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(new Error('JSON parse failed: ' + body.slice(0, 200))) }
      })
      res.on('error', reject)
    }).on('timeout', function () { this.destroy(); reject(new Error('timeout')) })
    .on('error', reject)
  })
}

// wttr.in weather code → Chinese description
const WEATHER_DESC = {
  113: '晴天', 116: '多云', 119: '阴天', 122: '阴天',
  143: '雾', 176: '零星小雨', 179: '零星小雪',
  182: '雨夹雪', 185: '雨夹雪',
  200: '雷阵雨', 227: '阵雪', 230: '暴风雪',
  248: '雾', 260: '霜雾',
  263: '毛毛雨', 266: '零星小雨', 281: '雨夹雪',
  284: '雨夹雪', 293: '小雨', 296: '毛毛雨',
  299: '中雨', 302: '中雨', 305: '大雨', 308: '强降雨',
  311: '小雨', 314: '中雨', 317: '雨夹雪', 320: '雨夹雪',
  323: '小雪', 326: '小雪', 329: '中雪', 332: '中雪',
  335: '大雪', 338: '大雪', 350: '冰雹', 353: '阵雨',
  356: '中阵雨', 359: '大阵雨', 362: '雨夹雪', 365: '雨夹雪',
  368: '阵雪', 371: '大阵雪', 374: '冰雹', 377: '冰雹',
  386: '雷阵雨', 389: '雷暴', 392: '雷暴+冰雹', 395: '强雷暴+冰雹',
}

router.get('/weather', async (req, res) => {
  try {
    const { city, days } = req.query
    const forecastDays = Math.min(parseInt(days) || 7, 7)

    if (!city) {
      return res.status(400).json({ error: '请提供 city 参数' })
    }

    // Clean city name for URL
    let q = city.trim()
    // Try to keep Chinese city names intact — wttr.in handles them well
    const encoded = encodeURIComponent(q)

    // Fetch from wttr.in with JSON format
    const url = `https://wttr.in/${encoded}?format=j1`
    const data = await fetchJSON(url)

    if (!data || !data.current_condition || !data.current_condition.length) {
      return res.status(404).json({ error: `未找到该城市天气数据: ${city}，请尝试用城市名（如"深圳"、"北京"）或英文名` })
    }

    const current = data.current_condition[0]
    const cityName = (data.nearest_area && data.nearest_area[0])
      ? [data.nearest_area[0].areaName?.[0]?.value, data.nearest_area[0].country?.[0]?.value].filter(Boolean).join(', ')
      : q

    // Parse current conditions
    const currentWeather = {
      temp_c: current.temp_C,
      feels_like_c: current.FeelsLikeC,
      humidity: current.humidity,
      weather_desc: current.weatherDesc?.[0]?.value || '',
      weather_code: WEATHER_DESC[parseInt(current.weatherCode)] || current.weatherDesc?.[0]?.value || '未知',
      wind_speed_kmh: current.windspeedKmph,
      wind_dir: current.winddir16Point,
      pressure_mb: current.pressure,
    }

    // Parse daily forecast
    const allDays = data.weather || []
    const daysData = allDays.slice(0, forecastDays).map(day => {
      const hourly = day.hourly || []
      // Calculate max/min from hourly data for better accuracy
      let tempMax = -99, tempMin = 99
      let precipSum = 0
      let windMax = 0
      hourly.forEach(h => {
        const t = parseFloat(h.tempC)
        if (!isNaN(t)) {
          if (t > tempMax) tempMax = t
          if (t < tempMin) tempMin = t
        }
        precipSum += parseFloat(h.precipMM) || 0
        const w = parseFloat(h.windspeedKmph) || 0
        if (w > windMax) windMax = w
      })
      // Get the midday weather code for the day's description
      const midday = hourly.find(h => h.time === '1200') || hourly[Math.floor(hourly.length / 2)] || hourly[0]
      const weatherCode = midday ? (WEATHER_DESC[parseInt(midday.weatherCode)] || midday.weatherDesc?.[0]?.value || '未知') : '未知'
      const avgHumidity = Math.round(hourly.reduce((s, h) => s + (parseInt(h.humidity) || 0), 0) / (hourly.length || 1))

      return {
        date: day.date,
        temp_max: tempMax > -99 ? Math.round(tempMax) : parseInt(day.maxtempC) || 0,
        temp_min: tempMin < 99 ? Math.round(tempMin) : parseInt(day.mintempC) || 0,
        weather: weatherCode,
        precip_total: Math.round(precipSum * 10) / 10,
        precip_prob: Math.round(Math.min(100, precipSum * 10)),
        wind_max: Math.round(windMax),
        humidity: avgHumidity,
        sunrise: day.astronomy?.[0]?.sunrise || '',
        sunset: day.astronomy?.[0]?.sunset || '',
      }
    })

    res.json({
      city: cityName,
      current: currentWeather,
      days: daysData,
      source: 'wttr.in (free, no API key)',
    })
  } catch (e) {
    console.error('[weather] wttr.in error:', e.message)
    res.status(500).json({ error: '天气查询失败: ' + e.message })
  }
})

module.exports = router
