node 'monitoring-server' {
  include monitoring_stack
}

node default {
  include hardware_agent
}
