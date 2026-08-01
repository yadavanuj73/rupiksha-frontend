#!/bin/bash
set -e

echo "🚀 Starting Rupiksha AWS EC2 Deployment..."

# 1. Update Frontend Files
echo "📦 Updating Frontend web assets in /var/www/rupiksha..."
sudo mkdir -p /var/www/rupiksha
sudo rm -rf /var/www/rupiksha/*
sudo cp -r /tmp/frontend-dist/* /var/www/rupiksha/
sudo chown -R www-data:www-data /var/www/rupiksha
sudo chmod -R 755 /var/www/rupiksha

# 2. Update Backend Jar
echo "☕ Updating Spring Boot Backend JAR..."
sudo mkdir -p /opt/rupiksha/backend
sudo cp /tmp/backend-jar/backend-java-0.0.1-SNAPSHOT.jar /opt/rupiksha/backend/
sudo chown -R ubuntu:ubuntu /opt/rupiksha/backend

# 3. Reload Nginx & Restart Spring Boot Backend
echo "🔄 Reloading Nginx & Restarting Spring Boot Service..."
sudo systemctl reload nginx || sudo systemctl restart nginx
sudo systemctl restart rupiksha-backend

echo "✅ Rupiksha AWS EC2 Deployment Complete!"
