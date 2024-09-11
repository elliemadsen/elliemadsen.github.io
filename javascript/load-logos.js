document.addEventListener('DOMContentLoaded', function() {
    fetch('../main/logos.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('logos-container').innerHTML = data;
        })
        .catch(error => console.error('Error loading the logos:', error));
});