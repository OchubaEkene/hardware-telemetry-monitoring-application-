# Class: monitoring_stack
#
# Masterless Puppet — manages Docker + Docker Compose monitoring stack on EC2.
# Applied automatically via EC2 user-data.
class monitoring_stack {

  # ── Docker installation ──────────────────────────────────────────────────────
  package { ['docker.io', 'docker-compose']:
    ensure => installed,
  }

  service { 'docker':
    ensure  => running,
    enable  => true,
    require => Package['docker.io'],
  }

  # ── Monitoring directory tree ────────────────────────────────────────────────
  $base = '/opt/monitoring'

  file { $base:
    ensure => directory,
    owner  => 'root',
    group  => 'root',
    mode   => '0755',
  }

  $dirs = [
    "${base}/prometheus",
    "${base}/grafana",
    "${base}/grafana/provisioning",
    "${base}/grafana/provisioning/datasources",
    "${base}/grafana/provisioning/dashboards",
    "${base}/grafana/dashboards",
  ]

  file { $dirs:
    ensure  => directory,
    owner   => 'root',
    group   => 'root',
    mode    => '0755',
    require => File[$base],
  }

  # ── Config files ─────────────────────────────────────────────────────────────
  file { "${base}/docker-compose.yml":
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    source  => 'puppet:///modules/monitoring_stack/docker-compose.yml',
    require => File[$base],
    notify  => Exec['docker-compose-up'],
  }

  file { "${base}/prometheus/prometheus.yml":
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    source  => 'puppet:///modules/monitoring_stack/prometheus.yml',
    require => File["${base}/prometheus"],
    notify  => Exec['docker-compose-up'],
  }

  file { "${base}/prometheus/alerts.yml":
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    source  => 'puppet:///modules/monitoring_stack/alerts.yml',
    require => File["${base}/prometheus"],
    notify  => Exec['docker-compose-up'],
  }

  file { "${base}/grafana/provisioning/datasources/prometheus.yml":
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    source  => 'puppet:///modules/monitoring_stack/datasources/prometheus.yml',
    require => File["${base}/grafana/provisioning/datasources"],
    notify  => Exec['docker-compose-up'],
  }

  file { "${base}/grafana/provisioning/dashboards/dashboards.yml":
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    source  => 'puppet:///modules/monitoring_stack/dashboards.yml',
    require => File["${base}/grafana/provisioning/dashboards"],
    notify  => Exec['docker-compose-up'],
  }

  file { "${base}/grafana/dashboards/hardware-monitor.json":
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    source  => 'puppet:///modules/monitoring_stack/hardware-monitor.json',
    require => File["${base}/grafana/dashboards"],
    notify  => Exec['docker-compose-up'],
  }

  # ── Docker Compose up (refreshonly — triggered by file changes) ──────────────
  exec { 'docker-compose-up':
    command     => "/usr/bin/docker-compose -f ${base}/docker-compose.yml up -d",
    refreshonly => true,
    require     => [Service['docker'], Package['docker-compose']],
  }

  # ── systemd service to start compose on boot ─────────────────────────────────
  file { '/etc/systemd/system/monitoring-stack.service':
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    content => @("EOT")
      [Unit]
      Description=Hardware Monitor Compose Stack
      After=docker.service network-online.target
      Requires=docker.service

      [Service]
      Type=oneshot
      RemainAfterExit=yes
      WorkingDirectory=${base}
      ExecStart=/usr/bin/docker-compose up -d
      ExecStop=/usr/bin/docker-compose down
      TimeoutStartSec=0

      [Install]
      WantedBy=multi-user.target
      | EOT
    notify  => Exec['systemd-daemon-reload-monitoring'],
  }

  exec { 'systemd-daemon-reload-monitoring':
    command     => '/bin/systemctl daemon-reload',
    refreshonly => true,
  }

  service { 'monitoring-stack':
    ensure  => running,
    enable  => true,
    require => [
      File['/etc/systemd/system/monitoring-stack.service'],
      Exec['systemd-daemon-reload-monitoring'],
      Exec['docker-compose-up'],
    ],
  }

  # ── Firewall (ufw) ───────────────────────────────────────────────────────────
  exec { 'ufw-allow-ssh':
    command => '/usr/sbin/ufw allow 22/tcp',
    unless  => '/usr/sbin/ufw status | grep -q "22/tcp"',
  }

  exec { 'ufw-allow-grafana':
    command => '/usr/sbin/ufw allow 3000/tcp',
    unless  => '/usr/sbin/ufw status | grep -q "3000/tcp"',
  }

  exec { 'ufw-allow-prometheus':
    command => '/usr/sbin/ufw allow 9090/tcp',
    unless  => '/usr/sbin/ufw status | grep -q "9090/tcp"',
  }
}
