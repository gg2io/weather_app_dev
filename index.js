const search = document.querySelector('.search-box button');
const todayInfo = document.querySelector('.today-info');
const todayWeatherIcon = document.querySelector('.today-weather i');
const todayTemp = document.querySelector('.weather-temp');
const daysList = document.querySelector('.days-list');
const searchInput = document.querySelector('.search-box input');
const suggestionsList = document.querySelector('.suggestions-list');

let debounceTimer;

// Mapping of weather condition codes to icon class names (Depending on Openweather Api Response)
const weatherIconMap = {
    '01d': 'sun',
    '01n': 'moon',
    '02d': 'sun',
    '02n': 'moon',
    '03d': 'cloud',
    '03n': 'cloud',
    '04d': 'cloud',
    '04n': 'cloud',
    '09d': 'cloud-rain',
    '09n': 'cloud-rain',
    '10d': 'cloud-rain',
    '10n': 'cloud-rain',
    '11d': 'cloud-lightning',
    '11n': 'cloud-lightning',
    '13d': 'cloud-snow',
    '13n': 'cloud-snow',
    '50d': 'water',
    '50n': 'water'
};

// Debounce function to limit API calls
function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

// Fetch location suggestions from geocoding API
async function fetchLocationSuggestions(query) {
    if (query.length < 4) {
        hideSuggestions();
        return;
    }

    try {
        // Using api.gg2.io proxy to keep API key secure on server-side
        const response = await fetch(`https://api.gg2.io/geocode?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        displaySuggestions(data);
    } catch (error) {
        console.log("Failed to fetch location suggestions", error);
        hideSuggestions();
    }
}

// Display location suggestions
function displaySuggestions(locations) {
    if (!locations || locations.length === 0) {
        hideSuggestions();
        return;
    }

    // Remove duplicates based on name + country combination
    const seen = new Set();
    const uniqueLocations = locations.filter(location => {
        const key = `${location.name}-${location.country}`.toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });

    // Sort locations: prioritize GB, then US, then others
    const sortedLocations = uniqueLocations.sort((a, b) => {
        // GB locations first
        if (a.country === 'GB' && b.country !== 'GB') return -1;
        if (a.country !== 'GB' && b.country === 'GB') return 1;

        // Then US locations
        if (a.country === 'US' && b.country !== 'US') return -1;
        if (a.country !== 'US' && b.country === 'US') return 1;

        // Keep original order for others
        return 0;
    });

    suggestionsList.innerHTML = '';

    sortedLocations.forEach(location => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="location-name">${location.name}, ${location.country}</div>
            <div class="location-details">${location.state || ''}</div>
        `;
        li.dataset.name = location.name;
        li.dataset.country = location.country;
        li.dataset.lat = location.lat;
        li.dataset.lon = location.lon;

        li.addEventListener('click', () => selectSuggestion(li));
        suggestionsList.appendChild(li);
    });

    suggestionsList.classList.add('active');
}

// Hide suggestions
function hideSuggestions() {
    suggestionsList.classList.remove('active');
    suggestionsList.innerHTML = '';
}

// Select a suggestion
function selectSuggestion(suggestionElement) {
    const name = suggestionElement.dataset.name;
    const country = suggestionElement.dataset.country;
    const lat = suggestionElement.dataset.lat;
    const lon = suggestionElement.dataset.lon;
    const location = `${name},${country}`;

    // Use coordinates for accurate weather data
    fetchWeatherData(location, lat, lon);
    searchInput.value = '';
    hideSuggestions();
    searchInput.blur();
}

async function fetchWeatherData(location, lat = null, lon = null) {
    // Construct the API url with the location/coordinates and api key
    let apiUrl;
    if (lat && lon) {
        // Use coordinates for more accurate results (from suggestions)
        apiUrl = `https://api.gg2.io/?lat=${lat}&lon=${lon}`;
    } else {
        // Use location name (from manual typing)
        apiUrl = `https://api.gg2.io/?location=${location}`;
    }

    // Fetch weather data from api
    try {
        const response = await fetch (apiUrl)
        const data = await response.json ()
        // Update todays info
        const todayWeather = data.list[0].weather[0].description;
        const todayTemperature = `${Math.round(data.list[0].main.temp)}°C`;
        const todayWeatherIconCode = data.list[0].weather[0].icon;

        todayInfo.querySelector('h2').textContent = new Date().toLocaleDateString('en', { weekday: 'long' });
        todayInfo.querySelector('span').textContent = new Date().toLocaleDateString('en-gb', { day: 'numeric', month: 'long', year: 'numeric' });
        todayWeatherIcon.className = `bx bx-${weatherIconMap[todayWeatherIconCode]}`;
        todayTemp.textContent = todayTemperature;

        // Update location and weather description in the "left-info" section
        const locationElement = document.querySelector('.today-info > div > span');
        locationElement.textContent = `${data.city.name}, ${data.city.country}`;

        const weatherDescriptionElement = document.querySelector('.today-weather > h3');
        weatherDescriptionElement.textContent = todayWeather;

        // Update todays info in the "day-info" section
        const todayPrecipitation = `${data.list[0].pop}%`;
        const todayHumidity = `${data.list[0].main.humidity}%`;
        const todayWindSpeed = `${data.list[0].wind.speed} km/h`;

        const dayInfoContainer = document.querySelector('.day-info');
        dayInfoContainer.innerHTML = `

            <div>
                <span class="title">PRECIPITATION</span>
                <span class="value">${todayPrecipitation}</span>
            </div>
            <div>
                <span class="title">HUMIDITY</span>
                <span class="value">${todayHumidity}</span>
            </div>
            <div>
                <span class="title">WIND SPEED</span>
                <span class="value">${todayWindSpeed}</span>
            </div>

        `;

        // Show the container after data loads
        document.querySelector('.container').style.opacity = '1';

        // Update next 4 days weather
        const today = new Date();
        const nextDaysData = data.list.slice(1);

        const uniqueDays = new Set();
        let count = 0;
        daysList.innerHTML = '';
        for (const dayData of nextDaysData) {
            const forecastDate = new Date(dayData.dt_txt);
            const dayAbbreviation = forecastDate.toLocaleDateString('en', { weekday: 'short' });
            const dayTemp = `${Math.round(dayData.main.temp)}°C`;
            const iconCode = dayData.weather[0].icon;

            // Ensure the day isn't duplicate and today
            if (!uniqueDays.has(dayAbbreviation) && forecastDate.getDate() !== today.getDate()) {
                uniqueDays.add(dayAbbreviation);
                daysList.innerHTML += `
                
                    <li>
                        <i class='bx bx-${weatherIconMap[iconCode]}'></i>
                        <span>${dayAbbreviation}</span>
                        <span class="day-temp">${dayTemp}</span>
                    </li>

                `;
                count++;
            }

            // Stop after getting 5 distinct days
            if (count === 5) break;
        }
    } catch(error) {
        console.log("Failed to load data from API", error)
        window.location.assign("not-found.html");
    };
}

// Fetch weather data on document load for default location (London)
document.addEventListener('DOMContentLoaded', () => {
    const defaultLocation = 'London';
    fetchWeatherData(defaultLocation);
});

function handleSearch(){
    const inputElement = document.querySelector('.search-box input');
    let location = inputElement.value;
    if (location === '')
        return;

    // Default to GB if no country code specified
    if (!location.includes(',')) {
        location = `${location},GB`;
    }

    fetchWeatherData(location);
    inputElement.value = '';
    inputElement.blur();
    hideSuggestions();   
}

search.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// Add input event listener with debouncing for autocomplete
searchInput.addEventListener('input', debounce(function(e) {
    const query = e.target.value.trim();
    fetchLocationSuggestions(query);
}, 300));

// Hide suggestions when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-box')) {
        hideSuggestions();
    }
});

// Keyboard navigation for suggestions
searchInput.addEventListener('keydown', function(e) {
    const suggestions = suggestionsList.querySelectorAll('li');
    const selected = suggestionsList.querySelector('li.selected');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!selected) {
            suggestions[0]?.classList.add('selected');
        } else {
            selected.classList.remove('selected');
            const next = selected.nextElementSibling || suggestions[0];
            next.classList.add('selected');
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selected) {
            selected.classList.remove('selected');
            const prev = selected.previousElementSibling || suggestions[suggestions.length - 1];
            prev.classList.add('selected');
        }
    } else if (e.key === 'Enter' && selected) {
        e.preventDefault();
        selectSuggestion(selected);
    } else if (e.key === 'Escape') {
        hideSuggestions();
    }
});