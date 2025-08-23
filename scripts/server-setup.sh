#!/bin/bash

# Server Setup Script for Tanzania Event Platform
# For fresh Ubuntu/Debian VPS (server1.ufumbuzilabs.com)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        fail2ban \
        htop \
        vim \
        nano \
        tree \
        jq \
        openssl
    
    log "System packages updated"
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc || true
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    log "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    log "Installing Docker Compose..."
    
    # Get latest version
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)
    
    # Download and install
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Make executable
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log "Docker Compose installed successfully"
}

# Create application user
create_app_user() {
    log "Creating application user..."
    
    # Create user if it doesn't exist
    if ! id "appuser" &>/dev/null; then
        useradd -m -s /bin/bash appuser
        
        # Add to docker group
        usermod -aG docker appuser
        
        # Setup SSH directory
        mkdir -p /home/appuser/.ssh
        chown appuser:appuser /home/appuser/.ssh
        chmod 700 /home/appuser/.ssh
        
        log "Application user created"
    else
        log "Application user already exists"
    fi
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (be careful with this!)
    ufw allow 22/tcp
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow specific services (optional)
    # ufw allow from 10.0.0.0/8 to any port 5432  # PostgreSQL from internal network
    # ufw allow from 10.0.0.0/8 to any port 6379  # Redis from internal network
    
    # Enable firewall
    ufw --force enable
    
    log "Firewall configured"
}

# Configure fail2ban
configure_fail2ban() {
    log "Configuring fail2ban..."
    
    # Create custom jail configuration
    cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
EOF
    
    # Restart fail2ban
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log "Fail2ban configured"
}

# Setup swap file
setup_swap() {
    log "Setting up swap file..."
    
    # Check if swap already exists
    if swapon --show | grep -q "/swapfile"; then
        log "Swap file already exists"
        return
    fi
    
    # Create 2GB swap file
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    
    # Add to fstab
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
    
    # Configure swappiness
    echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf
    
    log "Swap file configured"
}

# Optimize system for production
optimize_system() {
    log "Optimizing system for production..."
    
    # Increase file descriptors limit
    cat >> /etc/security/limits.conf <<EOF
* soft nofile 65536
* hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF
    
    # Optimize kernel parameters
    cat >> /etc/sysctl.conf <<EOF
# Network optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 12288 16777216
net.ipv4.tcp_wmem = 4096 12288 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr

# File system optimizations
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# Memory management
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF
    
    # Apply changes
    sysctl -p
    
    log "System optimized"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    # Create log directories
    mkdir -p /var/log/tanzania-event-platform
    
    # Setup logrotate configuration
    cat > /etc/logrotate.d/tanzania-event-platform <<EOF
/var/log/tanzania-event-platform/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 appuser appuser
}

/opt/tanzania-event-platform/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 appuser appuser
}
EOF
    
    log "Log rotation configured"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up basic monitoring..."
    
    # Install monitoring tools
    apt-get install -y htop iotop nethogs
    
    # Create monitoring script
    cat > /usr/local/bin/system-monitor <<EOF
#!/bin/bash
echo "=== System Status ==="
echo "Date: \$(date)"
echo "Uptime: \$(uptime)"
echo "Load Average: \$(cat /proc/loadavg)"
echo "Memory Usage:"
free -h
echo "Disk Usage:"
df -h
echo "Docker Status:"
docker system df
echo "Running Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF
    
    chmod +x /usr/local/bin/system-monitor
    
    log "Monitoring tools installed"
}

# Setup SSL certificate directory
setup_ssl_directory() {
    log "Setting up SSL certificate directory..."
    
    mkdir -p /opt/ssl/certbot
    mkdir -p /opt/ssl/nginx
    chown -R appuser:appuser /opt/ssl
    
    log "SSL directory configured"
}

# Display final information
display_final_info() {
    log "=== Server Setup Complete ==="
    info "Server IP: 203.161.60.72"
    info "Domain: server1.ufumbuzilabs.com"
    info "Application user: appuser"
    info "Application directory: /opt/tanzania-event-platform"
    info "Backup directory: /opt/backups"
    
    echo ""
    warn "IMPORTANT NEXT STEPS:"
    echo "1. Copy your SSH key to appuser: ssh-copy-id appuser@203.161.60.72"
    echo "2. Update DNS records to point server1.ufumbuzilabs.com to 203.161.60.72"
    echo "3. Run the deployment script as appuser: ./scripts/deploy.sh"
    echo "4. Configure environment variables in production.env"
    echo "5. Set up SSL certificates with Let's Encrypt"
    
    echo ""
    info "Useful commands:"
    echo "- Check system status: system-monitor"
    echo "- View firewall status: ufw status"
    echo "- View fail2ban status: fail2ban-client status"
    echo "- Check Docker: docker ps"
    echo "- View logs: docker-compose logs -f"
}

# Main setup function
main() {
    log "Starting server setup for Tanzania Event Platform..."
    
    check_root
    update_system
    install_docker
    install_docker_compose
    create_app_user
    configure_firewall
    configure_fail2ban
    setup_swap
    optimize_system
    setup_log_rotation
    setup_monitoring
    setup_ssl_directory
    display_final_info
    
    log "Server setup completed successfully!"
}

# Run main function
main "$@"

