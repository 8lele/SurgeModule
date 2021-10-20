// 此脚本仅适用于 iOS 14 的天气 App
// Developed by Hackl0us (https://github.com/hackl0us)

// STEP 1: 前往 https://aqicn.org/data-platform/token/ 注册账户，将申请的 API Token 填入下方
const aqicnToken = 'e969dc9722f4fdb8c6e3cd3e08db262266f964b8'

// STEP 2: 参考下方配置片段，在代理工具的配置文件中添加对应的配置。注意：script-path 后应该替换为添加 apicnToken 值后的脚本路径
/*
	[Script]
	iOS14美标空气质量 = type=http-response,pattern=https://weather-data.apple.com/v1/weather/[\w-]+/-?[0-9]+\.[0-9]+/-?[0-9]+\.[0-9]+\?,requires-body=true,script-path=path/to/iOS14_Weather_AQI_US.js

	[MITM]
	hostname = weather-data.apple.com
*/

const AirQualityStandard = {
	CN: 'HJ6332012.2115',
	US: 'EPA_NowCast.2115'
}

const AirQualityLevel = {
	GOOD: 1,
	MODERATE: 2,
	UNHEALTHY_FOR_SENSITIVE: 3,
	UNHEALTHY: 4,
	VERY_UNHEALTHY: 5,
	HAZARDOUS: 6
}

const MillisecondsConversion = 1000
const coordRegex = /https:\/\/weather-data\.apple\.com\/v1\/weather\/([\w-]+)\/(-?[0-9]+\.[0-9]+)\/(-?[0-9]+\.[0-9]+)\?/
const [_, language, lat, lng] = $request.url.match(coordRegex)


function classifyAirQualityLevel(aqiIndex) {
	if (aqiIndex >= 0 && aqiIndex <= 50) {
		return AirQualityLevel.GOOD;
	} else if (aqiIndex >= 51 && aqiIndex <= 100) {
		return AirQualityLevel.MODERATE;
	} else if (aqiIndex >= 101 && aqiIndex <= 150) {
		return AirQualityLevel.UNHEALTHY_FOR_SENSITIVE;
	} else if (aqiIndex >= 151 && aqiIndex <= 200) {
		return AirQualityLevel.UNHEALTHY;
	} else if (aqiIndex >= 201 && aqiIndex <= 300) {
		return AirQualityLevel.VERY_UNHEALTHY;
	} else if (aqiIndex >= 301) {
		return AirQualityLevel.HAZARDOUS;
	}
}

function modifyWeatherResp(weatherRespBody, aqicnRespBody) {
	let weatherRespJson = JSON.parse(weatherRespBody)
	let aqicnRespJson = JSON.parse(aqicnRespBody).data
	weatherRespJson.air_quality = constructAirQuailityNode(aqicnRespJson)
	return JSON.stringify(weatherRespJson)
}

function getPrimaryPollutant(pollutant) {
	switch (pollutant) {
		case 'co':
			return 'CO2';
		case 'so2':
			return 'SO2';
		case 'no2':
			return 'NO2';
		case 'pm25':
			return 'PM2.5';
		case 'pm10':
			return 'PM10';
		case 'o3':
			return 'OZONE';
		default:
			return "OTHER";
	}
}

function constructAirQuailityNode(aqicnData) {
	let airQualityNode = { "source": "", "learnMoreURL": "", "isSignificant": true, "airQualityCategoryIndex": 1, "airQualityScale": "", "airQualityIndex": 0, "pollutants": { "CO": { "name": "CO", "amount": 0, "unit": "μg/m3" }, "SO2": { "name": "SO2", "amount": 0, "unit": "μg/m3" }, "NO2": { "name": "NO2", "amount": 0, "unit": "μg/m3" }, "PM2.5": { "name": "PM2.5", "amount": 0, "unit": "μg/m3" }, "OZONE": { "name": "OZONE", "amount": 0, "unit": "μg/m3" }, "PM10": { "name": "PM10", "amount": 0, "unit": "μg/m3" } }, "metadata": { "reported_time": 0, "longitude": 0, "provider_name": "aqicn.org", "expire_time": 2, "provider_logo": "https://aqicn.org/mapi/logo.png", "read_time": 2, "latitude": 0, "version": 1, "language": "", "data_source": 0 }, "name": "AirQuality", "primaryPollutant": "" }
	const aqicnIndex = aqicnData.aqi
	airQualityNode.source = aqicnData.city.name
	airQualityNode.learnMoreURL = aqicnData.city.url + '/cn/m'

	airQualityNode.airQualityCategoryIndex = classifyAirQualityLevel(aqicnIndex)
	airQualityNode.airQualityScale = AirQualityStandard.US
	airQualityNode.airQualityIndex = aqicnIndex
	airQualityNode.primaryPollutant = getPrimaryPollutant(aqicnData.dominentpol)

	airQualityNode.pollutants.CO.amount = aqicnData.iaqi.co?.v || -1
	airQualityNode.pollutants.SO2.amount = aqicnData.iaqi.so2?.v || -1
	airQualityNode.pollutants.NO2.amount = aqicnData.iaqi.no2?.v || -1
	airQualityNode.pollutants["PM2.5"].amount = aqicnData.iaqi.pm25?.v || -1
	airQualityNode.pollutants.OZONE.amount = aqicnData.iaqi.o3?.v || -1
	airQualityNode.pollutants.PM10.amount = aqicnData.iaqi.pm10?.v || -1

	airQualityNode.metadata.latitude = aqicnData.city.geo[0]
	airQualityNode.metadata.longitude = aqicnData.city.geo[1]
	airQualityNode.metadata.reported_time = timeConversion(new Date(aqicnData.time.iso), 'remain')
	airQualityNode.metadata.read_time = timeConversion(new Date(), 'remain')
	airQualityNode.metadata.expire_time = timeConversion(new Date(aqicnData.time.iso), 'add-1h-floor')
	airQualityNode.metadata.language = language

	return airQualityNode
}

function timeConversion(time, action) {
	switch (action) {
		case 'remain':
			time.setMilliseconds(0);
			break;
		case 'add-1h-floor':
			time.setHours(time.getHours() + 1);
			time.setMinutes(0, 0, 0);
			break;
		default:
			console.log("Error time converting action.");
	}
	return time.getTime() / MillisecondsConversion;
}


$httpClient.get(`https://api.waqi.info/feed/geo:${lat};${lng}/?token=${aqicnToken}`, function (error, _response, data) {
	if (error) {
		let body = $response.body
		$done({ body })
	} else {
		let body = modifyWeatherResp($response.body, data)
		$done({ body })
	}
});
