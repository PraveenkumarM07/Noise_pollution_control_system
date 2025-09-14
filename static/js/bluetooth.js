// Bluetooth functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if Web Bluetooth is supported
    if (!navigator.bluetooth) {
        showError("Web Bluetooth is not supported in this browser. Please use a compatible browser like Chrome.");
        return;
    }

    const connectButton = document.getElementById('connectButton');
    const connectionStatus = document.getElementById('connectionStatus');
    const deviceInfo = document.getElementById('deviceInfo');
    const statusText = document.getElementById('statusText');
    const deviceName = document.getElementById('deviceName');
    const batteryLevel = document.getElementById('batteryLevel');
    const inputNoiseLevel = document.getElementById('inputNoiseLevel');
    const outputNoiseLevel = document.getElementById('outputNoiseLevel');
    const aiStatus = document.getElementById('aiStatus');

    let bluetoothDevice = null;
    let gattServer = null;
    let batteryService = null;
    let noiseService = null;
    let isConnected = false;

    // Custom service and characteristic UUIDs for noise monitoring
    const NOISE_SERVICE_UUID = '00000000-0000-1000-8000-00805f9b34fb';
    const INPUT_NOISE_CHARACTERISTIC_UUID = '00000001-0000-1000-8000-00805f9b34fb';
    const OUTPUT_NOISE_CHARACTERISTIC_UUID = '00000002-0000-1000-8000-00805f9b34fb';
    const AI_STATUS_CHARACTERISTIC_UUID = '00000003-0000-1000-8000-00805f9b34fb';

    connectButton.addEventListener('click', async () => {
        if (isConnected) {
            await disconnectDevice();
            return;
        }

        try {
            showStatus("Requesting Bluetooth Device...");
            bluetoothDevice = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['battery_service'] },
                    { namePrefix: 'NoiseGuard' }
                ],
                optionalServices: [NOISE_SERVICE_UUID]
            });

            bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

            showStatus("Connecting to GATT Server...");
            gattServer = await bluetoothDevice.gatt.connect();

            // Connect and get battery service
            showStatus("Getting Battery Service...");
            batteryService = await gattServer.getPrimaryService('battery_service');
            const batteryCharacteristic = await batteryService.getCharacteristic('battery_level');

            // Set up battery level notifications
            await batteryCharacteristic.startNotifications();
            batteryCharacteristic.addEventListener('characteristicvaluechanged', handleBatteryLevel);

            // Try to get noise service if available
            try {
                noiseService = await gattServer.getPrimaryService(NOISE_SERVICE_UUID);
                await setupNoiseMonitoring();
            } catch (error) {
                console.log('Noise monitoring service not available:', error);
            }

            // Update UI for connected state
            deviceName.textContent = bluetoothDevice.name || "Unknown Device";
            showDeviceInfo();
            updateConnectionButton(true);
            isConnected = true;

        } catch (error) {
            console.error(error);
            showError("Failed to connect: " + error.message);
            await disconnectDevice();
        }
    });

    async function setupNoiseMonitoring() {
        try {
            // Set up input noise monitoring
            const inputNoiseChar = await noiseService.getCharacteristic(INPUT_NOISE_CHARACTERISTIC_UUID);
            await inputNoiseChar.startNotifications();
            inputNoiseChar.addEventListener('characteristicvaluechanged', handleInputNoise);

            // Set up output noise monitoring
            const outputNoiseChar = await noiseService.getCharacteristic(OUTPUT_NOISE_CHARACTERISTIC_UUID);
            await outputNoiseChar.startNotifications();
            outputNoiseChar.addEventListener('characteristicvaluechanged', handleOutputNoise);

            // Set up AI status monitoring
            const aiStatusChar = await noiseService.getCharacteristic(AI_STATUS_CHARACTERISTIC_UUID);
            await aiStatusChar.startNotifications();
            aiStatusChar.addEventListener('characteristicvaluechanged', handleAIStatus);
        } catch (error) {
            console.log('Error setting up noise monitoring:', error);
        }
    }

    function handleBatteryLevel(event) {
        const battery = event.target.value.getUint8(0);
        batteryLevel.textContent = battery + '%';
        updateBatteryIcon(battery);
    }

    function handleInputNoise(event) {
        const noise = event.target.value.getInt16(0, true);
        inputNoiseLevel.textContent = noise + ' dB';
    }

    function handleOutputNoise(event) {
        const noise = event.target.value.getInt16(0, true);
        outputNoiseLevel.textContent = noise + ' dB';
    }

    function handleAIStatus(event) {
        const status = event.target.value.getUint8(0);
        aiStatus.textContent = status === 1 ? 'Active' : 'Inactive';
    }

    async function disconnectDevice() {
        if (gattServer && gattServer.connected) {
            await gattServer.disconnect();
        }
        resetUI();
        isConnected = false;
        updateConnectionButton(false);
    }

    function onDisconnected() {
        resetUI();
        isConnected = false;
        updateConnectionButton(false);
        showError("Device disconnected");
    }

    function resetUI() {
        deviceInfo.style.display = 'none';
        deviceName.textContent = 'Not Connected';
        batteryLevel.textContent = 'N/A';
        inputNoiseLevel.textContent = 'N/A';
        outputNoiseLevel.textContent = 'N/A';
        aiStatus.textContent = 'N/A';
    }

    function showStatus(message) {
        connectionStatus.style.display = 'block';
        statusText.textContent = message;
    }

    function showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    function showDeviceInfo() {
        connectionStatus.style.display = 'none';
        deviceInfo.style.display = 'block';
    }

    function updateConnectionButton(connected) {
        connectButton.innerHTML = connected ? 
            '<i class="fas fa-power-off"></i> Disconnect' : 
            '<i class="fas fa-bluetooth"></i> Connect Device';
        connectButton.style.background = connected ? 
            'rgba(255,0,0,0.2)' : 'rgba(255,255,255,0.2)';
    }

    function updateBatteryIcon(level) {
        let batteryIcon;
        if (level >= 75) batteryIcon = 'battery-full';
        else if (level >= 50) batteryIcon = 'battery-three-quarters';
        else if (level >= 25) batteryIcon = 'battery-half';
        else if (level >= 10) batteryIcon = 'battery-quarter';
        else batteryIcon = 'battery-empty';
        
        const iconElement = batteryLevel.parentElement.querySelector('.fas');
        iconElement.className = `fas fa-${batteryIcon}`;
    }
});