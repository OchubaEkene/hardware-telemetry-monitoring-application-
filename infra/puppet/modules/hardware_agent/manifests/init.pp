# Class: hardware_agent
#
# Masterless Puppet — manages the hardware telemetry agent on a Linux PC.
# Apply with: puppet apply site.pp --modulepath modules/
class hardware_agent {

  # ── System packages ─────────────────────────────────────────────────────────
  package { ['python3', 'python3-pip']:
    ensure => installed,
  }

  # ── Python dependencies (idempotent) ────────────────────────────────────────
  exec { 'install-agent-pip-deps':
    command => '/usr/bin/pip3 install websockets psutil prometheus_client',
    unless  => '/usr/bin/pip3 show prometheus_client 2>/dev/null | grep -q "Name: prometheus.client"',
    require => Package['python3-pip'],
  }

  # ── Agent directory + source ─────────────────────────────────────────────────
  file { '/opt/hardware-agent':
    ensure => directory,
    owner  => 'root',
    group  => 'root',
    mode   => '0755',
  }

  file { '/opt/hardware-agent/agent.py':
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0755',
    source  => 'puppet:///modules/hardware_agent/agent.py',
    require => File['/opt/hardware-agent'],
    notify  => Service['hardware-agent'],
  }

  # ── systemd unit ─────────────────────────────────────────────────────────────
  file { '/etc/systemd/system/hardware-agent.service':
    ensure  => file,
    owner   => 'root',
    group   => 'root',
    mode    => '0644',
    source  => 'puppet:///modules/hardware_agent/hardware-agent.service',
    notify  => [Exec['systemd-daemon-reload'], Service['hardware-agent']],
  }

  exec { 'systemd-daemon-reload':
    command     => '/bin/systemctl daemon-reload',
    refreshonly => true,
    require     => File['/etc/systemd/system/hardware-agent.service'],
  }

  service { 'hardware-agent':
    ensure  => running,
    enable  => true,
    require => [
      Exec['systemd-daemon-reload'],
      Exec['install-agent-pip-deps'],
      File['/opt/hardware-agent/agent.py'],
    ],
  }

  # ── Log rotation ─────────────────────────────────────────────────────────────
  file { '/var/log/hardware-agent':
    ensure => directory,
    owner  => 'root',
    group  => 'root',
    mode   => '0755',
  }

  file { '/etc/logrotate.d/hardware-agent':
    ensure => file,
    owner  => 'root',
    group  => 'root',
    mode   => '0644',
    source => 'puppet:///modules/hardware_agent/hardware-agent.logrotate',
  }

  # ── Firewall (ufw) ───────────────────────────────────────────────────────────
  exec { 'ufw-allow-websocket':
    command => '/usr/sbin/ufw allow 8765/tcp',
    unless  => '/usr/sbin/ufw status | grep -q "8765/tcp"',
  }

  exec { 'ufw-allow-metrics':
    command => '/usr/sbin/ufw allow 9100/tcp',
    unless  => '/usr/sbin/ufw status | grep -q "9100/tcp"',
  }
}
