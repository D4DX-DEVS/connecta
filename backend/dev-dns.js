// Dev only: some networks' DNS can't resolve MongoDB Atlas SRV records.
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
