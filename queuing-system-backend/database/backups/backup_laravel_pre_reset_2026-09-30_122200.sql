-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: laravel
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `display_settings`
--

DROP TABLE IF EXISTS `display_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `display_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `settings` longtext NOT NULL,
  `published_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `display_settings_published_by_foreign` (`published_by`),
  CONSTRAINT `display_settings_published_by_foreign` FOREIGN KEY (`published_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `display_settings`
--

LOCK TABLES `display_settings` WRITE;
/*!40000 ALTER TABLE `display_settings` DISABLE KEYS */;
INSERT INTO `display_settings` VALUES (1,'{\"enabledDepartments\":[\"Cashier\",\"Registrar\",\"ITM\",\"Admission\"],\"theme\":\"dark\",\"layout\":\"compact\",\"displayFontFamily\":\"system\",\"displayTextSize\":\"medium\",\"waitingLimit\":6,\"waitingFontSize\":\"medium\",\"showWaitingQueue\":true,\"showClock\":true,\"showDate\":true,\"showLiveIndicator\":true,\"queuePosition\":\"right\",\"flashEnabled\":true,\"flashSpeed\":\"medium\",\"animation\":\"pulse\",\"voiceEnabled\":true,\"voiceLanguage\":\"english\",\"voiceSpeed\":\"normal\",\"voiceVolume\":0.75,\"announcementEnabled\":true,\"announcement\":\"\\ud83d\\udce2 Welcome to Lyceum of Alabang. Please prepare your Student ID before proceeding to your assigned window.\",\"announcementSpeed\":\"medium\",\"displayLabels\":{\"nowServing\":\"NOW SERVING\",\"window\":\"WINDOW\",\"waitingQueue\":\"WAITING QUEUE\",\"waiting\":\"waiting\",\"waitingTicket\":\"waiting ticket\",\"waitingTickets\":\"waiting tickets\",\"noWaitingTickets\":\"No waiting tickets\",\"live\":\"LIVE\",\"moreTemplate\":\"+{count} more\",\"departmentNames\":{\"Cashier\":\"Cashier\",\"Registrar\":\"Registrar\",\"ITM\":\"ITM\",\"Admission\":\"Admission\"},\"windowLabels\":[]},\"schoolName\":\"Lyceum\",\"subtitle\":\"Queue Management System\",\"accentColor\":\"#f2c64b\",\"announcementTextColor\":\"#071b4d\",\"nowServingTextColor\":\"#ffffff\",\"nowServingBackgroundColor\":\"#071238\",\"windowTicketTextColor\":\"#ffffff\",\"dateTimeTextColor\":\"#ffffff\",\"waitingQueueColors\":{\"background\":\"#071238\",\"text\":\"#ffffff\"},\"backgroundType\":\"solid\",\"backgroundColor\":\"#071b4d\",\"panelColors\":{\"Cashier\":{\"background\":\"#10264d\",\"text\":\"#ffffff\"},\"Registrar\":{\"background\":\"#10264d\",\"text\":\"#ffffff\"},\"ITM\":{\"background\":\"#10264d\",\"text\":\"#ffffff\"},\"Admission\":{\"background\":\"#10264d\",\"text\":\"#ffffff\"}},\"backgroundGradient\":\"linear-gradient(135deg, rgba(7,27,77,0.95), rgba(14,52,105,0.82))\",\"backgroundImage\":null,\"logoImage\":null,\"fontControls\":{\"nowServing\":{\"fontFamily\":\"poppins\",\"fontSize\":\"large\",\"fontWeight\":\"900\"},\"waitingQueue\":{\"fontFamily\":\"poppins\",\"fontSize\":\"medium\",\"fontWeight\":\"900\"},\"serviceNames\":{\"fontFamily\":\"poppins\",\"fontSize\":\"xlarge\",\"fontWeight\":\"700\"},\"windowLabels\":{\"fontFamily\":\"poppins\",\"fontSize\":\"xlarge\",\"fontWeight\":\"800\"},\"ticketNumbers\":{\"fontFamily\":\"poppins\",\"fontSize\":\"xlarge\",\"fontWeight\":\"900\"},\"waitingQueueTickets\":{\"fontFamily\":\"poppins\",\"fontSize\":\"medium\",\"fontWeight\":\"700\"}},\"completedCount\":184,\"cancelledCount\":9,\"fontSize\":\"large\"}',4,'2026-09-17 01:47:46','2026-09-29 19:45:57');
/*!40000 ALTER TABLE `display_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `display_windows`
--

DROP TABLE IF EXISTS `display_windows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `display_windows` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service_window_id` bigint(20) unsigned DEFAULT NULL,
  `window_number` int(10) unsigned NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `department` varchar(40) NOT NULL,
  `display_color` varchar(20) NOT NULL DEFAULT '#2563eb',
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `display_windows_department_window_number_unique` (`department`,`window_number`),
  UNIQUE KEY `display_windows_sort_order_unique` (`sort_order`),
  KEY `display_windows_service_window_id_foreign` (`service_window_id`),
  CONSTRAINT `display_windows_service_window_id_foreign` FOREIGN KEY (`service_window_id`) REFERENCES `service_windows` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=407 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `display_windows`
--

LOCK TABLES `display_windows` WRITE;
/*!40000 ALTER TABLE `display_windows` DISABLE KEYS */;
INSERT INTO `display_windows` VALUES (395,7,1,'Cashier','Cashier','#fbf3e0',1,1,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(396,8,2,'Cashier','Cashier','#fbf3e0',1,2,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(397,9,3,'Cashier','Cashier','#fbf3e0',1,3,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(398,2,9,'Registrar','Registrar','#10b981',1,4,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(399,3,10,'Registrar','Registrar','#10b981',1,5,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(400,4,11,'Registrar','Registrar','#10b981',1,6,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(401,5,12,'Registrar','Registrar','#10b981',1,7,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(402,6,13,'Registrar','Registrar','#10b981',1,8,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(403,1,1,'ITM Window 1','ITM','#0284c7',1,9,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(404,10,1,'Admission Window 1','Admission','#8b5cf6',1,10,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(405,11,2,'ITM Window 2','ITM','#0284c7',1,11,'2026-09-29 19:45:57','2026-09-29 19:45:57'),(406,12,3,'ITM Window 3','ITM','#0284c7',1,12,'2026-09-29 19:45:57','2026-09-29 19:45:57');
/*!40000 ALTER TABLE `display_windows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'2026_02_07_120027_create_personal_access_tokens_table',1),(2,'2026_02_20_000001_create_users_table',1),(3,'2026_02_20_000002_create_queue_tickets_table',1),(4,'2026_02_20_000003_create_service_transactions_table',1),(5,'2026_02_20_000004_create_service_logs_table',1),(6,'2026_02_24_180145_create_sessions_table',1),(7,'2026_02_26_033254_add_window_to_queue_tickets_table',1),(8,'2026_07_27_000000_add_student_number_and_timestamps_to_queue_tickets_table',1),(9,'2026_08_04_000001_create_service_windows_table',1),(10,'2026_08_04_000002_add_itm_to_users_position_enum',1),(11,'2026_08_04_000003_modify_service_type_in_queue_tickets',1),(12,'2026_08_25_000001_add_security_code_lookup_index_to_users_table',1),(13,'2026_08_25_000002_add_staff_queue_lookup_indexes',1),(14,'2026_08_26_000001_add_status_to_service_windows_table',1),(15,'2026_08_27_000001_add_staff_id_to_service_windows_table',1),(16,'2026_08_27_000002_add_transaction_type_to_queue_tickets_table',1),(17,'2026_08_27_000003_create_display_configuration_tables',1),(18,'2026_08_27_000004_add_service_scope_to_service_windows',1),(19,'2026_08_28_000001_allow_itm_queue_service_type',1),(20,'2026_09_04_000001_create_independent_itm_window',1),(21,'2026_09_12_000001_repair_cashier_window_assignments',1),(22,'2026_09_24_000001_create_students_directory_and_ticket_snapshot_fields',2),(23,'2026_09_24_000002_use_existing_student_directory',3),(24,'2026_09_27_000001_enable_shared_departments',4);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=139 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (1,'App\\Models\\User',5,'auth_token','8a374d425e5deefa087a53401194090120b28b2b7632838fd94e5d0965fe1eff','[\"*\"]',NULL,NULL,'2026-09-17 01:14:32','2026-09-17 01:14:32'),(2,'App\\Models\\User',4,'auth_token','8d202a614adadf5984383f2ce003998f99747a511a38c33a45f5a5ec80eaccb5','[\"*\"]',NULL,NULL,'2026-09-17 01:14:33','2026-09-17 01:14:33'),(4,'App\\Models\\User',4,'auth_token','68bd4b86c7f48dcddea786783575e2f92f5038823ecfab6610465aa8b6d686e2','[\"*\"]','2026-09-17 01:40:32',NULL,'2026-09-17 01:37:37','2026-09-17 01:40:32'),(5,'App\\Models\\User',5,'auth_token','063a9162af37732e9eba34835c3f6ad3ab44a5bbb22b191a4414da74e8388365','[\"*\"]','2026-09-17 01:39:59',NULL,'2026-09-17 01:39:56','2026-09-17 01:39:59'),(6,'App\\Models\\User',5,'auth_token','be0d8dda5eb06efa5babfa0c2d2cff303e090683057a3431f4eac551979a49cd','[\"*\"]','2026-09-17 01:46:49',NULL,'2026-09-17 01:40:00','2026-09-17 01:46:49'),(7,'App\\Models\\User',5,'auth_token','ef10a9376d2f4c2c0ed5b8c21e0c8de122319448a1b336a3a8ffc1a2bba90621','[\"*\"]',NULL,NULL,'2026-09-17 01:40:24','2026-09-17 01:40:24'),(8,'App\\Models\\User',6,'auth_token','2005a76a26a3c0211b6383cf102c8cd3c945f8c244f0ff776fc8ba281280be59','[\"*\"]','2026-09-17 01:47:01',NULL,'2026-09-17 01:40:51','2026-09-17 01:47:01'),(9,'App\\Models\\User',5,'auth_token','72cf796eb83c094d69b27a70ceae98723de90328c8f063fc7c69696f45438dc2','[\"*\"]','2026-09-17 02:47:08',NULL,'2026-09-17 01:46:50','2026-09-17 02:47:08'),(10,'App\\Models\\User',4,'auth_token','84c95fb91c0d39ec431c62e0189ef546f84c686b0fd68c5b6b5fbb9bfa607561','[\"*\"]','2026-09-17 01:48:34',NULL,'2026-09-17 01:47:25','2026-09-17 01:48:34'),(11,'App\\Models\\User',6,'auth_token','c387da263354c467b476664a1be9c3fd529a9d52e4789a61f9186b1e3ca9b427','[\"*\"]','2026-09-17 01:49:18',NULL,'2026-09-17 01:48:43','2026-09-17 01:49:18'),(13,'App\\Models\\User',6,'auth_token','0661c40cf59f6244d11acca0dfa893ad38bed3e50aff31a7e62778f636aed6b5','[\"*\"]','2026-09-17 02:07:57',NULL,'2026-09-17 01:56:08','2026-09-17 02:07:57'),(14,'App\\Models\\User',6,'auth_token','4038e2865cd4ae412a633c09c00d3c769a892152da35b2162f999006beeb9878','[\"*\"]','2026-09-17 04:06:14',NULL,'2026-09-17 02:08:46','2026-09-17 04:06:14'),(18,'App\\Models\\User',8,'auth_token','e43def76981d2a1cd49758d331ec84ef44e6050f35849dc6945b9aa2250d1960','[\"*\"]','2026-09-17 04:18:35',NULL,'2026-09-17 04:17:18','2026-09-17 04:18:35'),(19,'App\\Models\\User',9,'auth_token','00a14495590b52484f450cb0a6791527387094cd503fd40217e79b5ebdad3299','[\"*\"]','2026-09-17 04:18:51',NULL,'2026-09-17 04:18:37','2026-09-17 04:18:51'),(20,'App\\Models\\User',10,'auth_token','81cfd51363f330b4aab0535af937e597afc38788b2119f751bc901d07a5c12c2','[\"*\"]','2026-09-17 04:19:47',NULL,'2026-09-17 04:18:52','2026-09-17 04:19:47'),(21,'App\\Models\\User',11,'auth_token','b7c8c2705927699dadb94046b788c357524e9589c6169e9605dac7cf7d3a8aeb','[\"*\"]','2026-09-17 04:25:13',NULL,'2026-09-17 04:19:43','2026-09-17 04:25:13'),(22,'App\\Models\\User',4,'auth_token','690bc1162ae2caf31c1c4c1517dc65a2a606c6620ca8e2fb14f07d3128b02568','[\"*\"]','2026-09-17 04:28:05',NULL,'2026-09-17 04:25:23','2026-09-17 04:28:05'),(29,'App\\Models\\User',7,'auth_token','495a64992d38b848e76b034c568b71bf1ec8ed1cd4fc53aa329a3776d8b2848a','[\"*\"]','2026-09-17 05:13:56',NULL,'2026-09-17 05:03:38','2026-09-17 05:13:56'),(31,'App\\Models\\User',7,'auth_token','cd82fad1919abf7f2a62256600a72b5de7459a28e18be86adad3241ce80ade2f','[\"*\"]','2026-09-17 05:14:24',NULL,'2026-09-17 05:14:22','2026-09-17 05:14:24'),(32,'App\\Models\\User',7,'auth_token','8cdc4322cba2bbe26d023214889193c2fd9fe55b0a09694898bc44352512471a','[\"*\"]','2026-09-17 05:15:02',NULL,'2026-09-17 05:14:31','2026-09-17 05:15:02'),(34,'App\\Models\\User',7,'auth_token','601af4701fe22c3f48bf32cb011026fbf79c25ba05ebb9b1e3f3639ad2437ef5','[\"*\"]','2026-09-17 05:15:55',NULL,'2026-09-17 05:15:33','2026-09-17 05:15:55'),(37,'App\\Models\\User',7,'auth_token','714a7ae0f849074b7f35a16380b0d8cfaf7ffaf884cccb696a8f3600b089c7a1','[\"*\"]','2026-09-17 05:38:46',NULL,'2026-09-17 05:29:24','2026-09-17 05:38:46'),(44,'App\\Models\\User',7,'auth_token','3533790584d439067cf1c56e032367a158295629b7f91a9b55e0eb72e2438d2b','[\"*\"]','2026-09-17 06:02:37',NULL,'2026-09-17 06:02:36','2026-09-17 06:02:37'),(52,'App\\Models\\User',12,'auth_token','0c122d0cb128a0105104c18f6643d29cdb841344ea71de9feb9173a07b46333f','[\"*\"]','2026-09-17 06:13:50',NULL,'2026-09-17 06:12:22','2026-09-17 06:13:50'),(53,'App\\Models\\User',12,'auth_token','c77be8fd19b9bdccb3d24dec4c36b5fbb4d04fbc8f509a6a28883f632ca6f743','[\"*\"]','2026-09-17 06:13:57',NULL,'2026-09-17 06:13:49','2026-09-17 06:13:57'),(55,'App\\Models\\User',4,'auth_token','017cd9c48701efa6252eab39651c3b42df202aad28299f5e3e6d5733aceda9b6','[\"*\"]','2026-09-17 06:17:25',NULL,'2026-09-17 06:16:14','2026-09-17 06:17:25'),(60,'App\\Models\\User',7,'auth_token','f13c0d04d0ddd169c1737632011a509f6bf66ada5ab7642bd538f5fd2a0ce4bd','[\"*\"]','2026-09-17 06:31:52',NULL,'2026-09-17 06:31:06','2026-09-17 06:31:52'),(65,'App\\Models\\User',4,'auth_token','94dece273a372e3544c2f1299c51746ccd2b91d45380dc1a6b034e172727f2a6','[\"*\"]','2026-09-17 06:39:57',NULL,'2026-09-17 06:36:27','2026-09-17 06:39:57'),(67,'App\\Models\\User',5,'auth_token','e4c4e6d9ec8f803c22bb7198f8515883ffd45d2a55d6fc1b476264ae6ea6f44d','[\"*\"]',NULL,NULL,'2026-09-17 06:42:58','2026-09-17 06:42:58'),(68,'App\\Models\\User',4,'auth_token','03d055744b264d91c7226504ac6ca8080585a8cc15bedbb3cce3fcd4bd876fa7','[\"*\"]','2026-09-17 06:46:09',NULL,'2026-09-17 06:43:24','2026-09-17 06:46:09'),(72,'App\\Models\\User',4,'auth_token','3683ccd68b487eaa317347950ecfa87118b5148fd3b8453c8b7e9ba10ad074d6','[\"*\"]','2026-09-17 06:58:18',NULL,'2026-09-17 06:53:00','2026-09-17 06:58:18'),(73,'App\\Models\\User',4,'auth_token','a2574c6258b02ad9cdb70d9a86737b9d0d00d5bc2d09164ec92088f5e01b47a8','[\"*\"]','2026-09-17 07:44:44',NULL,'2026-09-17 06:57:21','2026-09-17 07:44:44'),(78,'App\\Models\\User',4,'auth_token','30c967a196326f3e5559363e7b68ec896fc24e12da82978ac03b3074ce544d33','[\"*\"]','2026-09-17 07:46:16',NULL,'2026-09-17 07:29:36','2026-09-17 07:46:16'),(79,'App\\Models\\User',3,'auth_token','cf4ef256e9106c5d4b698d051aab617218350a6aeabd73c2a2eda6bad11ecc0f','[\"*\"]','2026-09-17 07:46:50',NULL,'2026-09-17 07:46:25','2026-09-17 07:46:50'),(81,'App\\Models\\User',3,'auth_token','80b482ba52e17a7ee07a321dbcaf88cd744c73f33a0934802f8d9ba5f3a650fa','[\"*\"]','2026-09-17 23:43:49',NULL,'2026-09-17 07:47:13','2026-09-17 23:43:49'),(82,'App\\Models\\User',4,'auth_token','6ad9b42a3a387cac1387cb920336bb68c617096b754c38e6290ef3742286384d','[\"*\"]','2026-09-17 23:44:47',NULL,'2026-09-17 23:43:51','2026-09-17 23:44:47'),(83,'App\\Models\\User',5,'auth_token','f2359bdbd82e7ac54c540ca5fb6a040710f40b5524ecfafe925017d99c8f58ce','[\"*\"]','2026-09-17 23:46:22',NULL,'2026-09-17 23:44:51','2026-09-17 23:46:22'),(84,'App\\Models\\User',4,'auth_token','24900088d3e5ed88d5595baaea5fe6aed307ef954654352e523aaed153ae5cfb','[\"*\"]','2026-09-17 23:55:24',NULL,'2026-09-17 23:46:20','2026-09-17 23:55:24'),(85,'App\\Models\\User',4,'auth_token','7e4f0aa06a8250684b687cb6a679b00a55b401904ff500621d86b6ff7e5fe9fb','[\"*\"]','2026-09-17 23:56:05',NULL,'2026-09-17 23:55:26','2026-09-17 23:56:05'),(87,'App\\Models\\User',4,'auth_token','ec8ba24a09157340eb1ccd8d768dcf444365a5dc9f743d57f0ca51ada0dfe457','[\"*\"]','2026-09-18 00:31:00',NULL,'2026-09-17 23:56:53','2026-09-18 00:31:00'),(88,'App\\Models\\User',4,'auth_token','1fd9fa6972fa3c2645f7b2e36a7bd836ddff432958045628e3435cb1c811161e','[\"*\"]','2026-09-18 00:31:59',NULL,'2026-09-18 00:31:33','2026-09-18 00:31:59'),(89,'App\\Models\\User',5,'auth_token','66524143838768eadb73cfae624a8a6b9e493a27d1df0f7a302ca2f62200180d','[\"*\"]','2026-09-18 00:34:52',NULL,'2026-09-18 00:32:10','2026-09-18 00:34:52'),(90,'App\\Models\\User',8,'auth_token','21a4dfc1368ecb58311cbe870f61a4fcbc771ca37571a8278a7f41769046cfa6','[\"*\"]','2026-09-18 00:40:50',NULL,'2026-09-18 00:34:53','2026-09-18 00:40:50'),(91,'App\\Models\\User',8,'auth_token','c838669bea24fb2a1fc7142f8f80116b6a6b754b0f01812b4939b56492990ca7','[\"*\"]','2026-09-18 00:50:02',NULL,'2026-09-18 00:49:29','2026-09-18 00:50:02'),(92,'App\\Models\\User',9,'auth_token','979e99def017f0dc2881edb87354a447a4babe0b687f9ebc9c478032319f7d78','[\"*\"]','2026-09-18 00:52:49',NULL,'2026-09-18 00:49:39','2026-09-18 00:52:49'),(93,'App\\Models\\User',10,'auth_token','10c634be1dcfa6260f7f637240f05081b11e1a430e84b8021d4f309dbddf7a8a','[\"*\"]','2026-09-18 01:49:29',NULL,'2026-09-18 00:50:10','2026-09-18 01:49:29'),(94,'App\\Models\\User',11,'auth_token','0342466853f2f07ce5966e7338520c025bfa6663710e266f764a55fbca8bf566','[\"*\"]','2026-09-18 00:54:50',NULL,'2026-09-18 00:50:33','2026-09-18 00:54:50'),(95,'App\\Models\\User',12,'auth_token','df0ac7d4da978c681df881bd4632c63f10c63a854591c4870ef174b7335c088c','[\"*\"]','2026-09-18 00:55:00',NULL,'2026-09-18 00:50:56','2026-09-18 00:55:00'),(96,'App\\Models\\User',7,'auth_token','622771eaabb1a89d1e23c759d5d0f7a079b049777e0049a89dd3083df2846874','[\"*\"]','2026-09-18 01:11:19',NULL,'2026-09-18 00:52:30','2026-09-18 01:11:19'),(97,'App\\Models\\User',6,'auth_token','ec2affef16c9bf64c9cc83f69fcaa1a0d12e0a75d93e0f7f4c54a62ace97200a','[\"*\"]','2026-09-18 00:56:52',NULL,'2026-09-18 00:53:30','2026-09-18 00:56:52'),(98,'App\\Models\\User',5,'auth_token','62133ec8cc611097709d23eb99fe2a1644347a5180430439dd04d467b8e9d308','[\"*\"]','2026-09-18 00:57:02',NULL,'2026-09-18 00:53:54','2026-09-18 00:57:02'),(99,'App\\Models\\User',4,'auth_token','faad7c9a6b3d52ac302f1178070d2a16a2ed5d9cc28cda4c682c59c616b1ef02','[\"*\"]','2026-09-18 01:49:21',NULL,'2026-09-18 00:55:23','2026-09-18 01:49:21'),(100,'App\\Models\\User',3,'auth_token','4e428c8d0c67d6fb03ecb2dc8b13c39172a3c72c7de4ff2e5ba3ebecd9b2f816','[\"*\"]','2026-09-18 00:59:40',NULL,'2026-09-18 00:59:39','2026-09-18 00:59:40'),(101,'App\\Models\\User',12,'auth_token','ce2d4480041333ed93ea1270b7aa74ebeea728d67dc44f6d41bedf52965a20a3','[\"*\"]','2026-09-18 01:01:51',NULL,'2026-09-18 01:01:39','2026-09-18 01:01:51'),(103,'App\\Models\\User',5,'auth_token','f38b57d5f7294aca5f414719236464743ab079d1d1f649adb733aa660fff4c33','[\"*\"]','2026-09-18 01:04:22',NULL,'2026-09-18 01:04:00','2026-09-18 01:04:22'),(105,'App\\Models\\User',3,'auth_token','da1fb304e70795560f566d9f14fc827deaf8f4932310130201c0573fbcd35327','[\"*\"]','2026-09-18 01:07:40',NULL,'2026-09-18 01:07:38','2026-09-18 01:07:40'),(110,'App\\Models\\User',7,'auth_token','aa2fdbf7ef9b97302c5b367e1a6f47f78c88e8f1d80ea68131e4b6958e14613c','[\"*\"]','2026-09-18 01:12:53',NULL,'2026-09-18 01:10:34','2026-09-18 01:12:53'),(111,'App\\Models\\User',8,'auth_token','37f678b6289085b96ddc8fecbb23930822f9c825e8a8713b860220d8d69e8a79','[\"*\"]','2026-09-18 01:34:41',NULL,'2026-09-18 01:11:35','2026-09-18 01:34:41'),(112,'App\\Models\\User',8,'auth_token','75599a0434e053f1af86653ae93ee73c5280c7e284200c2aea093a9ef9a5d0f8','[\"*\"]','2026-09-18 01:14:03',NULL,'2026-09-18 01:13:07','2026-09-18 01:14:03'),(113,'App\\Models\\User',8,'auth_token','14e2c6ef0343ba1c0870f8a294b776794ca7c579ffca2d70c8a78ddb9a66a4fc','[\"*\"]','2026-09-18 01:33:54',NULL,'2026-09-18 01:18:44','2026-09-18 01:33:54'),(114,'App\\Models\\User',6,'auth_token','29a0c6b2aae9934e0f43eea73a7888d9bfe2ec3c46df871ded87b126abf829d9','[\"*\"]','2026-09-18 01:34:42',NULL,'2026-09-18 01:18:58','2026-09-18 01:34:42'),(115,'App\\Models\\User',6,'auth_token','380828e86df188ef0926cddbae1b4ba0154f8ee7e22b4ee9998ad3950b35ab65','[\"*\"]','2026-09-18 01:55:19',NULL,'2026-09-18 01:34:46','2026-09-18 01:55:19'),(116,'App\\Models\\User',12,'auth_token','0e272a283aa4468cf56609e36d17817261119d766dec5939789bf33edc24482d','[\"*\"]','2026-09-18 01:45:18',NULL,'2026-09-18 01:38:46','2026-09-18 01:45:18'),(117,'App\\Models\\User',12,'auth_token','b333dc3aa77e3ef28302d993ebf7a213fd9457c6a45bd2dae6cf4903f98ff421','[\"*\"]','2026-09-18 01:55:21',NULL,'2026-09-18 01:45:30','2026-09-18 01:55:21'),(118,'App\\Models\\User',4,'auth_token','328974004a43e808df5b7e20c90d64f9b05f947eb3beb3715a8b08c0362074eb','[\"*\"]','2026-09-24 10:23:06',NULL,'2026-09-24 07:09:04','2026-09-24 10:23:06'),(119,'App\\Models\\User',4,'auth_token','21edcccb5b1bc6236dda4f8e3fa67e01e1042b511879431e1dede9172cba96ab','[\"*\"]','2026-09-27 05:26:43',NULL,'2026-09-27 05:20:00','2026-09-27 05:26:43'),(120,'App\\Models\\User',4,'auth_token','433997cfc3cfe0b9a1441a34d214e2ebab90d4ff91b780265b678ebf06a78b6c','[\"*\"]','2026-09-27 06:11:23',NULL,'2026-09-27 05:26:47','2026-09-27 06:11:23'),(121,'App\\Models\\User',4,'auth_token','48459ae216beaa0a2e5f7d3e6f6dc483ae634b2cb8ae74dd882ee1636143682a','[\"*\"]','2026-09-27 11:42:34',NULL,'2026-09-27 06:11:25','2026-09-27 11:42:34'),(122,'App\\Models\\User',3,'auth_token','3fbb0cb8fd3c3bee9ddaf5ac2f99af9151a25996b83e654736d0a012b5c7e3ce','[\"*\"]','2026-09-27 06:17:07',NULL,'2026-09-27 06:17:05','2026-09-27 06:17:07'),(123,'App\\Models\\User',3,'auth_token','6b9d97ccbb055ec183cc9bb1fdb84091a365b5581817ed5b2370053d0cd4b283','[\"*\"]','2026-09-27 06:17:36',NULL,'2026-09-27 06:17:34','2026-09-27 06:17:36'),(124,'App\\Models\\User',3,'auth_token','338670f075fea64d12e2adf3c1acd75710d93d44f2ae116f41e93d68ff34c572','[\"*\"]','2026-09-27 07:42:36',NULL,'2026-09-27 06:51:38','2026-09-27 07:42:36'),(125,'App\\Models\\User',3,'auth_token','06774324039b02eb84f5373010ac0cd3d969e199ff37a822f6adeb3147c2550b','[\"*\"]','2026-09-27 07:53:39',NULL,'2026-09-27 07:42:40','2026-09-27 07:53:39'),(127,'App\\Models\\User',3,'auth_token','4d76642432640796ec7cf8d0a0409a63a4c2affa0e08a946e0ff3e0be22df1d7','[\"*\"]','2026-09-27 09:11:59',NULL,'2026-09-27 08:12:28','2026-09-27 09:11:59'),(128,'App\\Models\\User',16,'auth_token','e751c6a7fbed5f3739291ce66ee8b456cd731154c96ef024801b75e18924c289','[\"*\"]','2026-09-27 09:12:08',NULL,'2026-09-27 08:14:15','2026-09-27 09:12:08'),(129,'App\\Models\\User',3,'auth_token','d630cb7532104bb2648e93bd3676038e1025a649346999c015546aa5372e05c3','[\"*\"]','2026-09-27 09:12:03',NULL,'2026-09-27 09:12:00','2026-09-27 09:12:03'),(130,'App\\Models\\User',6,'auth_token','a0dbfb1ac99029f987c02c32d1dba33dc47b25ccd60eee6fa8e3e9958d4864c3','[\"*\"]','2026-09-27 09:12:18',NULL,'2026-09-27 09:12:15','2026-09-27 09:12:18'),(131,'App\\Models\\User',16,'auth_token','597972ee8ad730d4f401761ad166885bb3091f1127fda858f884a8d1b4c14176','[\"*\"]','2026-09-27 09:12:29',NULL,'2026-09-27 09:12:27','2026-09-27 09:12:29'),(132,'App\\Models\\User',8,'auth_token','e36620d3ba7744223f8844205d774a3f06b20f1f612759b5ce8c980cf097b388','[\"*\"]','2026-09-27 11:40:29',NULL,'2026-09-27 09:12:40','2026-09-27 11:40:29'),(133,'App\\Models\\User',8,'auth_token','3e2e7fe6a552c983992e267a279fd1a386c7fb7c46791ee1b9cc7042c08bb2a8','[\"*\"]','2026-09-29 03:41:21',NULL,'2026-09-29 03:41:11','2026-09-29 03:41:21'),(134,'App\\Models\\User',8,'auth_token','c922829a7e43266f0f835fd06a04e854ba7914edeffc14649f521f45b8f4fe05','[\"*\"]','2026-09-29 04:11:25',NULL,'2026-09-29 03:41:23','2026-09-29 04:11:25'),(135,'App\\Models\\User',4,'auth_token','411a793735cf3694ac7dbd88d7aae199e923f1188cb3936799ffbb0a08264e24','[\"*\"]','2026-09-29 03:49:30',NULL,'2026-09-29 03:42:03','2026-09-29 03:49:30'),(136,'App\\Models\\User',4,'auth_token','61376daccc37eb5884551923826abf11f6149de89537c80878076dbe6f6ea32f','[\"*\"]','2026-09-29 04:47:35',NULL,'2026-09-29 04:11:44','2026-09-29 04:47:35'),(137,'App\\Models\\User',4,'auth_token','a0a0a605be09ed0c2fc311e799d46a19993dddb8d0454a5957fd3909d490bb7a','[\"*\"]','2026-09-29 19:45:57',NULL,'2026-09-29 09:09:50','2026-09-29 19:45:57');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queue_tickets`
--

DROP TABLE IF EXISTS `queue_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `queue_tickets` (
  `ticket_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ticket_number` varchar(50) NOT NULL,
  `service_type` varchar(50) NOT NULL,
  `transaction_type` varchar(50) DEFAULT NULL,
  `student_number` varchar(100) DEFAULT NULL,
  `student_name` varchar(150) DEFAULT NULL,
  `course` varchar(200) DEFAULT NULL,
  `priority_type` enum('R','P') NOT NULL DEFAULT 'R' COMMENT 'R=Regular, P=Priority',
  `status` enum('waiting','serving','done','cancelled') NOT NULL DEFAULT 'waiting',
  `called_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `window` tinyint(4) DEFAULT NULL COMMENT 'Window number for registrar service (1-6)',
  PRIMARY KEY (`ticket_id`),
  UNIQUE KEY `queue_tickets_ticket_number_unique` (`ticket_number`),
  KEY `queue_tickets_staff_call_index` (`service_type`,`status`,`priority_type`,`created_at`),
  KEY `queue_tickets_staff_window_call_index` (`service_type`,`status`,`window`,`priority_type`,`created_at`),
  KEY `queue_tickets_transaction_analytics_index` (`service_type`,`status`,`transaction_type`,`completed_at`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queue_tickets`
--

LOCK TABLES `queue_tickets` WRITE;
/*!40000 ALTER TABLE `queue_tickets` DISABLE KEYS */;
INSERT INTO `queue_tickets` VALUES (1,'C-R001','C','Others','Guest',NULL,NULL,'R','done','2026-09-17 04:10:14','2026-09-17 04:10:24','2026-09-17 04:09:44',2),(2,'C-R002','C','Clearance','Guest',NULL,NULL,'R','done','2026-09-17 04:10:42','2026-09-17 04:14:20','2026-09-17 04:10:36',2),(3,'R-P001','R','Document Request','1518-23',NULL,NULL,'P','done','2026-09-17 05:00:01','2026-09-17 05:02:43','2026-09-17 04:17:40',9),(4,'R-R001','R','Clearance','Guest',NULL,NULL,'R','cancelled','2026-09-17 06:10:50',NULL,'2026-09-17 04:18:31',10),(5,'R-R002','R','Others','8245-22',NULL,NULL,'R','done','2026-09-17 04:51:27','2026-09-17 04:59:26','2026-09-17 04:19:23',11),(6,'R-P002','R','Document Request','Guest',NULL,NULL,'P','done','2026-09-17 04:20:48','2026-09-17 04:21:08','2026-09-17 04:20:22',12),(7,'C-P001','C','Others','Guest',NULL,NULL,'P','done','2026-09-17 06:31:11',NULL,'2026-09-17 06:30:32',3),(8,'C-R003','C','Payment','Guest',NULL,NULL,'R','done','2026-09-17 06:32:00','2026-09-17 06:34:22','2026-09-17 06:30:43',1),(10,'C-P002','C','Payment','1515-23',NULL,NULL,'P','done','2026-09-18 00:52:40','2026-09-18 00:56:43','2026-09-18 00:32:45',3),(11,'C-R004','C','Others','Guest',NULL,NULL,'R','done','2026-09-18 00:53:36','2026-09-18 00:56:52','2026-09-18 00:33:03',2),(12,'C-R005','C','Clearance','1927-24',NULL,NULL,'R','done','2026-09-18 00:54:12','2026-09-18 00:57:00','2026-09-18 00:33:23',1),(13,'R-R003','R','Document Request','2868-24',NULL,NULL,'R','done','2026-09-18 00:35:49','2026-09-18 00:39:49','2026-09-18 00:33:38',9),(14,'R-P003','R','Others','Guest',NULL,NULL,'P','done','2026-09-18 00:49:45','2026-09-18 00:52:49','2026-09-18 00:33:51',10),(15,'R-R004','R','Document Request','3986-25',NULL,NULL,'R','done','2026-09-18 00:50:15','2026-09-18 00:54:28','2026-09-18 00:34:03',11),(16,'R-R005','R','Clearance','Guest',NULL,NULL,'R','done','2026-09-18 00:50:40','2026-09-18 00:54:50','2026-09-18 00:34:16',12),(17,'R-R006','R','Others','Guest',NULL,NULL,'R','done','2026-09-18 00:51:09','2026-09-18 00:55:00','2026-09-18 00:34:24',13),(18,'C-R006','C','Clearance','Guest',NULL,NULL,'R','cancelled','2026-09-18 00:56:46',NULL,'2026-09-18 00:41:20',3),(21,'C-R007','C','Clearance','1515-23',NULL,NULL,'R','done','2026-09-18 01:10:38','2026-09-18 01:12:53','2026-09-18 01:03:18',3),(22,'C-P003','C','Others','Guest',NULL,NULL,'P','done','2026-09-18 01:08:57','2026-09-18 01:10:28','2026-09-18 01:03:35',2),(23,'R-R007','R','Document Request','Guest',NULL,NULL,'R','cancelled','2026-09-18 01:12:47',NULL,'2026-09-18 01:11:15',9),(24,'C-P004','C','Clearance','Guest',NULL,NULL,'P','serving','2026-09-18 01:36:38',NULL,'2026-09-18 01:34:06',2),(25,'R-P004','R','Others','Guest',NULL,NULL,'P','waiting',NULL,NULL,'2026-09-18 01:36:06',10),(26,'R-R008','R','Clearance','Guest',NULL,NULL,'R','waiting',NULL,NULL,'2026-09-18 01:37:54',13),(27,'R-P005','R','Clearance','1515-23',NULL,NULL,'P','serving','2026-09-18 01:45:40',NULL,'2026-09-18 01:38:33',13),(28,'R-R009','R','Clearance','1047-23','Ella Grace Bautista','PTCP','R','waiting',NULL,NULL,'2026-09-24 07:22:13',12),(29,'R-R010','R','Clearance','Guest',NULL,NULL,'R','waiting',NULL,NULL,'2026-09-24 07:22:27',12),(30,'R-P006','R','Clearance','1001-23','Alyssa Mae Santos','BSCRIM','P','waiting',NULL,NULL,'2026-09-24 07:38:03',9),(31,'R-P007','R','Document Request','1027-23','Beatrice Anne Bautista','BSIT','P','waiting',NULL,NULL,'2026-09-27 05:19:37',10),(32,'R-P008','R','Document Request','1027-23','Beatrice Anne Bautista','BSIT','P','waiting',NULL,NULL,'2026-09-27 05:32:02',10),(33,'R-R011','R','Document Request','1086-23','Kristine Mae Dela Cruz','BSPSYCH','R','waiting',NULL,NULL,'2026-09-27 05:40:43',9),(34,'ITMN-0001','ITM','ITM Service','Guest',NULL,NULL,'R','waiting',NULL,NULL,'2026-09-27 06:15:17',NULL),(35,'ITMN-0002','ITM','ITM Service','Guest',NULL,NULL,'R','waiting',NULL,NULL,'2026-09-27 06:16:03',NULL),(36,'C-P005','C','Others','1065-23',NULL,NULL,'P','waiting',NULL,NULL,'2026-09-27 09:33:41',NULL),(37,'C-R008','C','Payment','Guest',NULL,NULL,'R','waiting',NULL,NULL,'2026-09-29 04:27:39',NULL),(38,'R-P009','R','Document Request','1029-23','Clarisse Joy Villanueva','BSIE','P','waiting',NULL,NULL,'2026-09-29 09:08:21',10);
/*!40000 ALTER TABLE `queue_tickets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_logs`
--

DROP TABLE IF EXISTS `service_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_logs` (
  `log_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `action` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `service_logs_user_id_foreign` (`user_id`),
  CONSTRAINT `service_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=257 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_logs`
--

LOCK TABLES `service_logs` WRITE;
/*!40000 ALTER TABLE `service_logs` DISABLE KEYS */;
INSERT INTO `service_logs` VALUES (1,5,'User logged in: cashier1','2026-09-17 01:14:32'),(2,4,'User logged in: admin','2026-09-17 01:14:33'),(3,6,'User logged in: cashier2','2026-09-17 01:29:13'),(4,6,'User logged out: cashier2','2026-09-17 01:37:33'),(5,4,'User logged in: admin','2026-09-17 01:37:37'),(6,5,'User logged in: cashier1','2026-09-17 01:39:56'),(7,5,'User logged in: cashier1','2026-09-17 01:40:00'),(8,5,'User logged in: cashier1','2026-09-17 01:40:24'),(9,6,'User logged in: cashier2','2026-09-17 01:40:52'),(10,5,'User logged in: cashier1','2026-09-17 01:46:50'),(11,4,'User logged in: admin','2026-09-17 01:47:25'),(12,6,'User logged in: cashier2','2026-09-17 01:48:43'),(13,4,'User logged in: admin','2026-09-17 01:49:20'),(14,4,'User logged out: admin','2026-09-17 01:55:58'),(15,6,'User logged in: cashier2','2026-09-17 01:56:08'),(16,6,'User logged in: cashier2','2026-09-17 02:08:46'),(17,4,'User logged in: admin','2026-09-17 04:06:18'),(18,4,'User logged out: admin','2026-09-17 04:08:51'),(19,6,'User logged in: cashier2','2026-09-17 04:10:07'),(20,6,'Called ticket: C-R001','2026-09-17 04:10:14'),(21,6,'Completed ticket: C-R001 (Duration: -10.956225s)','2026-09-17 04:10:24'),(22,6,'Called ticket: C-R002','2026-09-17 04:10:42'),(23,6,'Completed ticket: C-R002 (Duration: -218.601264s)','2026-09-17 04:14:20'),(24,6,'User logged out: cashier2','2026-09-17 04:14:38'),(25,4,'User logged in: admin','2026-09-17 04:14:46'),(26,4,'User logged out: admin','2026-09-17 04:17:04'),(27,8,'User logged in: registrar1','2026-09-17 04:17:18'),(28,9,'User logged in: registrar2','2026-09-17 04:18:37'),(29,10,'User logged in: registrar3','2026-09-17 04:18:52'),(30,11,'User logged in: registrar4','2026-09-17 04:19:43'),(31,11,'Called ticket: R-P002','2026-09-17 04:20:48'),(32,11,'Completed ticket: R-P002 (Duration: -20.994252s)','2026-09-17 04:21:09'),(33,4,'User logged in: admin','2026-09-17 04:25:23'),(34,6,'User logged in: cashier2','2026-09-17 04:28:10'),(35,6,'User logged out: cashier2','2026-09-17 04:28:50'),(36,12,'User logged in: registrar5','2026-09-17 04:50:58'),(37,12,'User logged out: registrar5','2026-09-17 04:51:05'),(38,11,'User logged in: registrar4','2026-09-17 04:51:09'),(39,11,'User logged out: registrar4','2026-09-17 04:51:18'),(40,10,'User logged in: registrar3','2026-09-17 04:51:22'),(41,10,'Called ticket: R-R002','2026-09-17 04:51:27'),(42,10,'Completed ticket: R-R002 (Duration: -479.531869s)','2026-09-17 04:59:26'),(43,10,'User logged out: registrar3','2026-09-17 04:59:30'),(44,9,'User logged in: registrar2','2026-09-17 04:59:37'),(45,9,'User logged out: registrar2','2026-09-17 04:59:44'),(46,8,'User logged in: registrar1','2026-09-17 04:59:48'),(47,8,'Called ticket: R-P001','2026-09-17 05:00:01'),(48,8,'Completed ticket: R-P001 (Duration: -162.202597s)','2026-09-17 05:02:43'),(49,8,'User logged out: registrar1','2026-09-17 05:03:20'),(50,7,'User logged in: cashier3','2026-09-17 05:03:38'),(51,7,'User logged in: cashier3','2026-09-17 05:13:59'),(52,7,'User logged out: cashier3','2026-09-17 05:14:16'),(53,7,'User logged in: cashier3','2026-09-17 05:14:22'),(54,7,'User logged in: cashier3','2026-09-17 05:14:31'),(55,7,'User logged in: cashier3','2026-09-17 05:15:12'),(56,7,'User logged out: cashier3','2026-09-17 05:15:23'),(57,7,'User logged in: cashier3','2026-09-17 05:15:33'),(58,7,'User logged in: cashier3','2026-09-17 05:15:57'),(59,7,'User logged out: cashier3','2026-09-17 05:20:10'),(60,7,'User logged in: cashier3','2026-09-17 05:20:13'),(61,7,'User logged out: cashier3','2026-09-17 05:20:26'),(62,7,'User logged in: cashier3','2026-09-17 05:29:24'),(63,7,'User logged in: cashier3','2026-09-17 05:38:48'),(64,7,'User logged out: cashier3','2026-09-17 05:40:03'),(65,7,'User logged in: cashier3','2026-09-17 05:49:25'),(66,7,'User logged out: cashier3','2026-09-17 05:52:11'),(67,7,'User logged in: cashier3','2026-09-17 05:53:30'),(68,7,'User logged out: cashier3','2026-09-17 05:54:00'),(69,7,'User logged in: cashier3','2026-09-17 05:54:11'),(70,7,'User logged out: cashier3','2026-09-17 05:54:14'),(71,7,'User logged in: cashier3','2026-09-17 05:54:41'),(72,7,'User logged out: cashier3','2026-09-17 05:54:57'),(73,5,'User logged in: cashier1','2026-09-17 06:01:06'),(74,5,'User logged out: cashier1','2026-09-17 06:02:31'),(75,7,'User logged in: cashier3','2026-09-17 06:02:36'),(76,7,'User logged in: cashier3','2026-09-17 06:02:41'),(77,7,'User logged out: cashier3','2026-09-17 06:02:49'),(78,7,'User logged in: cashier3','2026-09-17 06:10:22'),(79,7,'User logged out: cashier3','2026-09-17 06:10:30'),(80,7,'User logged in: cashier3','2026-09-17 06:10:35'),(81,7,'User logged out: cashier3','2026-09-17 06:10:38'),(82,9,'User logged in: registrar2','2026-09-17 06:10:42'),(83,9,'Called ticket: R-R001','2026-09-17 06:10:50'),(84,9,'Skipped / no show: R-R001','2026-09-17 06:11:05'),(85,9,'User logged out: registrar2','2026-09-17 06:11:07'),(86,4,'User logged in: admin','2026-09-17 06:11:24'),(87,4,'User logged out: admin','2026-09-17 06:11:45'),(88,4,'User logged in: admin','2026-09-17 06:11:52'),(89,4,'User logged out: admin','2026-09-17 06:11:59'),(90,7,'User logged in: cashier3','2026-09-17 06:12:04'),(91,7,'User logged out: cashier3','2026-09-17 06:12:12'),(92,12,'User logged in: registrar5','2026-09-17 06:12:22'),(93,12,'User logged in: registrar5','2026-09-17 06:13:49'),(94,3,'User logged in: itm','2026-09-17 06:15:08'),(95,3,'User logged out: itm','2026-09-17 06:15:58'),(96,4,'User logged in: admin','2026-09-17 06:16:14'),(97,8,'User logged in: registrar1','2026-09-17 06:19:18'),(98,8,'User logged out: registrar1','2026-09-17 06:20:04'),(99,8,'User logged in: registrar1','2026-09-17 06:23:38'),(100,8,'User logged out: registrar1','2026-09-17 06:24:03'),(101,8,'User logged in: registrar1','2026-09-17 06:24:37'),(102,8,'User logged out: registrar1','2026-09-17 06:24:42'),(103,5,'User logged in: cashier1','2026-09-17 06:25:05'),(104,5,'User logged out: cashier1','2026-09-17 06:25:24'),(105,7,'User logged in: cashier3','2026-09-17 06:31:06'),(106,7,'Called ticket: C-P001','2026-09-17 06:31:11'),(107,5,'User logged in: cashier1','2026-09-17 06:31:53'),(108,5,'Called ticket: C-R003','2026-09-17 06:32:00'),(109,5,'Completed ticket: C-R003 (Duration: -142.482972s)','2026-09-17 06:34:22'),(110,5,'User logged out: cashier1','2026-09-17 06:34:51'),(111,5,'User logged in: cashier1','2026-09-17 06:35:02'),(112,5,'User logged out: cashier1','2026-09-17 06:35:06'),(113,8,'User logged in: registrar1','2026-09-17 06:35:21'),(114,8,'User logged out: registrar1','2026-09-17 06:35:29'),(115,11,'User logged in: registrar4','2026-09-17 06:35:58'),(116,11,'User logged out: registrar4','2026-09-17 06:36:06'),(117,4,'User logged in: admin','2026-09-17 06:36:27'),(118,4,'User logged in: admin','2026-09-17 06:42:37'),(119,4,'User logged out: admin','2026-09-17 06:42:53'),(120,5,'User logged in: cashier1','2026-09-17 06:42:58'),(121,4,'User logged in: admin','2026-09-17 06:43:24'),(122,5,'User logged in: cashier1','2026-09-17 06:46:15'),(123,5,'User logged out: cashier1','2026-09-17 06:47:10'),(124,4,'User logged in: admin','2026-09-17 06:47:15'),(125,4,'User logged out: admin','2026-09-17 06:52:40'),(126,4,'User logged in: admin','2026-09-17 06:52:44'),(127,4,'User logged out: admin','2026-09-17 06:52:51'),(128,4,'User logged in: admin','2026-09-17 06:53:00'),(129,4,'User logged in: admin','2026-09-17 06:57:21'),(130,4,'User logged in: admin','2026-09-17 06:58:20'),(131,4,'User logged out: admin','2026-09-17 06:58:33'),(132,5,'User logged in: cashier1','2026-09-17 06:58:46'),(133,5,'User logged out: cashier1','2026-09-17 06:58:59'),(134,8,'User logged in: registrar1','2026-09-17 06:59:08'),(135,8,'User logged out: registrar1','2026-09-17 06:59:19'),(136,4,'User logged in: admin','2026-09-17 07:06:03'),(137,4,'User logged out: admin','2026-09-17 07:25:08'),(138,4,'User logged in: admin','2026-09-17 07:29:36'),(139,3,'User logged in: itm','2026-09-17 07:46:25'),(140,4,'User logged in: admin','2026-09-17 07:46:54'),(141,4,'User logged out: admin','2026-09-17 07:47:03'),(142,3,'User logged in: itm','2026-09-17 07:47:13'),(143,4,'User logged in: admin','2026-09-17 23:43:51'),(144,5,'User logged in: cashier1','2026-09-17 23:44:51'),(145,4,'User logged in: admin','2026-09-17 23:46:20'),(146,4,'User logged in: admin','2026-09-17 23:55:26'),(147,5,'User logged in: cashier1','2026-09-17 23:56:17'),(148,5,'User logged out: cashier1','2026-09-17 23:56:26'),(149,4,'User logged in: admin','2026-09-17 23:56:53'),(150,4,'User logged in: admin','2026-09-18 00:31:33'),(151,5,'User logged in: cashier1','2026-09-18 00:32:10'),(152,8,'User logged in: registrar1','2026-09-18 00:34:53'),(153,8,'Called ticket: R-R003','2026-09-18 00:35:49'),(154,8,'Completed ticket: R-R003 (Duration: -240.505038s)','2026-09-18 00:39:49'),(155,8,'User logged in: registrar1','2026-09-18 00:49:29'),(156,9,'User logged in: registrar2','2026-09-18 00:49:39'),(157,9,'Called ticket: R-P003','2026-09-18 00:49:45'),(158,10,'User logged in: registrar3','2026-09-18 00:50:10'),(159,10,'Called ticket: R-R004','2026-09-18 00:50:15'),(160,11,'User logged in: registrar4','2026-09-18 00:50:33'),(161,11,'Called ticket: R-R005','2026-09-18 00:50:40'),(162,12,'User logged in: registrar5','2026-09-18 00:50:56'),(163,12,'Called ticket: R-R006','2026-09-18 00:51:09'),(164,7,'User logged in: cashier3','2026-09-18 00:52:30'),(165,7,'Called ticket: C-P002','2026-09-18 00:52:40'),(166,9,'Completed ticket: R-P003 (Duration: -184.010537s)','2026-09-18 00:52:49'),(167,6,'User logged in: cashier2','2026-09-18 00:53:30'),(168,6,'Called ticket: C-R004','2026-09-18 00:53:36'),(169,5,'User logged in: cashier1','2026-09-18 00:53:54'),(170,5,'Called ticket: C-R005','2026-09-18 00:54:12'),(171,10,'Completed ticket: R-R004 (Duration: -253.43565s)','2026-09-18 00:54:28'),(172,11,'Completed ticket: R-R005 (Duration: -250.958632s)','2026-09-18 00:54:50'),(173,12,'Completed ticket: R-R006 (Duration: -231.384682s)','2026-09-18 00:55:00'),(174,4,'User logged in: admin','2026-09-18 00:55:23'),(175,7,'Completed ticket: C-P002 (Duration: -243.158749s)','2026-09-18 00:56:43'),(176,7,'Called ticket: C-R006','2026-09-18 00:56:46'),(177,6,'Completed ticket: C-R004 (Duration: -196.420552s)','2026-09-18 00:56:52'),(178,5,'Completed ticket: C-R005 (Duration: -168.096321s)','2026-09-18 00:57:00'),(179,7,'Skipped / no show: C-R006','2026-09-18 00:57:40'),(180,3,'User logged in: itm','2026-09-18 00:59:39'),(181,12,'User logged in: registrar5','2026-09-18 01:01:39'),(182,5,'User logged in: cashier1','2026-09-18 01:04:00'),(183,3,'User logged in: itm','2026-09-18 01:07:38'),(184,6,'User logged in: cashier2','2026-09-18 01:08:53'),(185,6,'Called ticket: C-P003','2026-09-18 01:08:57'),(186,6,'User logged out: cashier2','2026-09-18 01:09:38'),(187,5,'User logged in: cashier1','2026-09-18 01:09:47'),(188,5,'User logged out: cashier1','2026-09-18 01:09:53'),(189,9,'User logged in: registrar2','2026-09-18 01:10:05'),(190,9,'User logged out: registrar2','2026-09-18 01:10:11'),(191,6,'User logged in: cashier2','2026-09-18 01:10:23'),(192,6,'Completed ticket: C-P003 (Duration: -91.377078s)','2026-09-18 01:10:28'),(193,6,'User logged out: cashier2','2026-09-18 01:10:31'),(194,7,'User logged in: cashier3','2026-09-18 01:10:34'),(195,7,'Called ticket: C-R007','2026-09-18 01:10:38'),(196,8,'User logged in: registrar1','2026-09-18 01:11:35'),(197,8,'Called ticket: R-R007','2026-09-18 01:12:47'),(198,7,'Completed ticket: C-R007 (Duration: -135.777195s)','2026-09-18 01:12:53'),(199,8,'User logged in: registrar1','2026-09-18 01:13:07'),(200,8,'Skipped / no show: R-R007','2026-09-18 01:14:03'),(201,8,'User logged in: registrar1','2026-09-18 01:18:44'),(202,6,'User logged in: cashier2','2026-09-18 01:18:58'),(203,6,'User logged in: cashier2','2026-09-18 01:34:46'),(204,6,'Called ticket: C-P004','2026-09-18 01:36:38'),(205,12,'User logged in: registrar5','2026-09-18 01:38:46'),(206,12,'User logged in: registrar5','2026-09-18 01:45:30'),(207,12,'Called ticket: R-P005','2026-09-18 01:45:40'),(208,4,'User logged in: admin','2026-09-24 07:09:04'),(209,4,'User logged in: admin','2026-09-27 05:20:00'),(210,4,'User logged in: admin','2026-09-27 05:26:47'),(211,4,'User logged in: admin','2026-09-27 06:11:25'),(212,4,'Published active departments: Cashier, Registrar, ITM','2026-09-27 06:12:20'),(213,4,'Published active departments: ITM','2026-09-27 06:15:41'),(214,3,'User logged in: itm','2026-09-27 06:17:05'),(215,3,'User logged in: itm','2026-09-27 06:17:34'),(216,4,'Published active departments: Cashier, Registrar, ITM, Admission','2026-09-27 06:22:00'),(217,3,'User logged in: itm','2026-09-27 06:51:38'),(218,4,'Published active departments: Cashier, Registrar, ITM','2026-09-27 06:51:59'),(219,4,'Published active departments: ITM','2026-09-27 06:53:07'),(220,4,'Published active departments: ITM, Admission','2026-09-27 07:03:22'),(221,3,'User logged in: itm','2026-09-27 07:42:40'),(222,4,'Published active departments: ITM, Admission','2026-09-27 07:43:38'),(223,4,'Published active departments: Cashier, Registrar','2026-09-27 07:43:46'),(224,4,'Published active departments: Cashier, Registrar','2026-09-27 08:10:57'),(225,4,'Published active departments: Cashier, Registrar, Admission','2026-09-27 08:11:39'),(226,16,'User logged in: admission1','2026-09-27 08:11:50'),(227,16,'User logged out: admission1','2026-09-27 08:12:01'),(228,4,'Published active departments: Cashier, Registrar, ITM, Admission','2026-09-27 08:12:24'),(229,3,'User logged in: itm','2026-09-27 08:12:28'),(230,16,'User logged in: admission1','2026-09-27 08:14:15'),(231,3,'User logged in: itm','2026-09-27 09:12:00'),(232,6,'User logged in: cashier2','2026-09-27 09:12:15'),(233,16,'User logged in: admission1','2026-09-27 09:12:27'),(234,8,'User logged in: registrar1','2026-09-27 09:12:40'),(235,4,'Published active departments: Cashier, Registrar','2026-09-27 09:39:12'),(236,4,'Published active departments: Cashier, Registrar','2026-09-27 10:36:53'),(237,8,'User logged in: registrar1','2026-09-29 03:41:11'),(238,8,'User logged in: registrar1','2026-09-29 03:41:23'),(239,4,'User logged in: admin','2026-09-29 03:42:03'),(240,4,'User logged in: admin','2026-09-29 04:11:44'),(241,4,'Published active departments: Cashier, Registrar, ITM','2026-09-29 04:12:45'),(242,4,'Published active departments: Cashier, Registrar, ITM, Admission','2026-09-29 04:12:56'),(243,4,'Published active departments: Cashier, Registrar, ITM, Admission','2026-09-29 04:27:37'),(244,4,'Published active departments: Cashier, Registrar','2026-09-29 04:30:09'),(245,4,'User logged in: admin','2026-09-29 09:09:50'),(246,4,'Published active departments: Cashier, Registrar','2026-09-29 10:09:36'),(247,4,'Published active departments: Cashier, Registrar','2026-09-29 10:27:31'),(248,4,'Published active departments: Cashier, Registrar, ITM, Admission','2026-09-29 10:27:49'),(249,4,'Published active departments: Cashier, Registrar','2026-09-29 16:52:54'),(250,4,'Published active departments: Cashier, Registrar','2026-09-29 17:41:05'),(251,5,'User logged in: cashier1','2026-09-29 18:14:12'),(252,5,'User logged out: cashier1','2026-09-29 18:14:27'),(253,4,'Published active departments: Cashier, Registrar','2026-09-29 19:43:37'),(254,4,'Published active departments: Cashier, Registrar','2026-09-29 19:44:03'),(255,4,'Published active departments: Cashier, Registrar','2026-09-29 19:44:21'),(256,4,'Published active departments: Cashier, Registrar, ITM, Admission','2026-09-29 19:45:57');
/*!40000 ALTER TABLE `service_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_transactions`
--

DROP TABLE IF EXISTS `service_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_transactions` (
  `transaction_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint(20) unsigned NOT NULL,
  `staff_id` bigint(20) unsigned NOT NULL,
  `start_time` timestamp NULL DEFAULT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration_seconds` int(11) DEFAULT NULL,
  `performance_rating` enum('Excellent','Very Good','Good','Fair','Poor') DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `service_transactions_staff_id_foreign` (`staff_id`),
  KEY `service_transactions_active_ticket_index` (`ticket_id`,`end_time`),
  CONSTRAINT `service_transactions_staff_id_foreign` FOREIGN KEY (`staff_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `service_transactions_ticket_id_foreign` FOREIGN KEY (`ticket_id`) REFERENCES `queue_tickets` (`ticket_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_transactions`
--

LOCK TABLES `service_transactions` WRITE;
/*!40000 ALTER TABLE `service_transactions` DISABLE KEYS */;
INSERT INTO `service_transactions` VALUES (1,1,6,'2026-09-17 04:10:14','2026-09-17 04:10:24',-11,NULL,NULL),(2,2,6,'2026-09-17 04:10:42','2026-09-17 04:14:20',-219,NULL,NULL),(3,6,11,'2026-09-17 04:20:48','2026-09-17 04:21:08',-21,NULL,NULL),(4,5,10,'2026-09-17 04:51:27','2026-09-17 04:59:26',-480,NULL,NULL),(5,3,8,'2026-09-17 05:00:01','2026-09-17 05:02:43',-162,NULL,NULL),(6,4,9,'2026-09-17 06:10:50','2026-09-17 06:11:05',-15,NULL,'Skip / No Show'),(7,7,7,'2026-09-17 06:31:11',NULL,NULL,NULL,NULL),(8,8,5,'2026-09-17 06:32:00','2026-09-17 06:34:22',-142,NULL,NULL),(9,13,8,'2026-09-18 00:35:49','2026-09-18 00:39:49',-241,NULL,NULL),(10,14,9,'2026-09-18 00:49:45','2026-09-18 00:52:49',-184,NULL,NULL),(11,15,10,'2026-09-18 00:50:15','2026-09-18 00:54:28',-253,NULL,NULL),(12,16,11,'2026-09-18 00:50:40','2026-09-18 00:54:50',-251,NULL,NULL),(13,17,12,'2026-09-18 00:51:09','2026-09-18 00:55:00',-231,NULL,NULL),(14,10,7,'2026-09-18 00:52:40','2026-09-18 00:56:43',-243,NULL,NULL),(15,11,6,'2026-09-18 00:53:36','2026-09-18 00:56:52',-196,NULL,NULL),(16,12,5,'2026-09-18 00:54:12','2026-09-18 00:57:00',-168,NULL,NULL),(17,18,7,'2026-09-18 00:56:46','2026-09-18 00:57:40',-55,NULL,'Skip / No Show'),(18,22,6,'2026-09-18 01:08:57','2026-09-18 01:10:28',-91,NULL,NULL),(19,21,7,'2026-09-18 01:10:38','2026-09-18 01:12:53',-136,NULL,NULL),(20,23,8,'2026-09-18 01:12:47','2026-09-18 01:14:03',-77,NULL,'Skip / No Show'),(21,24,6,'2026-09-18 01:36:38',NULL,NULL,NULL,NULL),(22,27,12,'2026-09-18 01:45:40',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `service_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_windows`
--

DROP TABLE IF EXISTS `service_windows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_windows` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `department` varchar(255) NOT NULL,
  `window_number` int(11) NOT NULL,
  `staff_id` bigint(20) unsigned DEFAULT NULL,
  `service_type` varchar(255) NOT NULL,
  `service_scope` varchar(20) NOT NULL DEFAULT 'department',
  `is_available` tinyint(1) NOT NULL DEFAULT 1,
  `status` varchar(10) NOT NULL DEFAULT 'open',
  `disabled_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `service_windows_department_window_number_unique` (`department`,`window_number`),
  UNIQUE KEY `service_windows_staff_id_unique` (`staff_id`),
  CONSTRAINT `service_windows_staff_id_foreign` FOREIGN KEY (`staff_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_windows`
--

LOCK TABLES `service_windows` WRITE;
/*!40000 ALTER TABLE `service_windows` DISABLE KEYS */;
INSERT INTO `service_windows` VALUES (1,'ITM',1,3,'ITM','department',1,'open',NULL,'2026-09-17 00:39:26','2026-09-17 01:14:05'),(2,'registrar',9,8,'RT','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-29 18:51:51'),(3,'registrar',10,9,'RT','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-29 18:51:51'),(4,'registrar',11,10,'RT','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-29 18:51:51'),(5,'registrar',12,11,'RT','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-29 18:51:51'),(6,'registrar',13,12,'RT','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-29 18:51:51'),(7,'Cashier',1,NULL,'CS','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-17 01:29:14'),(8,'Cashier',2,NULL,'CS','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-17 01:29:14'),(9,'Cashier',3,NULL,'CS','department',1,'open',NULL,'2026-09-17 01:29:14','2026-09-17 01:29:14'),(10,'Admission',1,16,'ADM','department',1,'open',NULL,'2026-09-27 06:02:20','2026-09-27 08:06:01'),(11,'ITM',2,17,'ITM','department',1,'open',NULL,'2026-09-29 04:31:56','2026-09-29 04:31:56'),(12,'ITM',3,18,'ITM','department',1,'open',NULL,'2026-09-29 04:31:56','2026-09-29 04:31:56');
/*!40000 ALTER TABLE `service_windows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_directory`
--

DROP TABLE IF EXISTS `student_directory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_directory` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_number` varchar(20) NOT NULL,
  `student_name` varchar(150) NOT NULL,
  `course` varchar(30) NOT NULL,
  `registrar_window` tinyint(3) unsigned NOT NULL,
  `routing_status` varchar(30) NOT NULL DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_number` (`student_number`)
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_directory`
--

LOCK TABLES `student_directory` WRITE;
/*!40000 ALTER TABLE `student_directory` DISABLE KEYS */;
INSERT INTO `student_directory` VALUES (1,'1001-23','Alyssa Mae Santos','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(2,'1002-23','Joshua Miguel Reyes','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(3,'1003-23','Andrea Nicole Cruz','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(4,'1004-23','Mark Joseph Garcia','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(5,'1005-23','Bianca Louise Mendoza','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(6,'1006-23','Daniel Carlo Dela Cruz','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(7,'1007-23','Sofia Anne Bautista','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(8,'1008-23','Gabriel James Navarro','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(9,'1009-23','Mia Isabelle Villanueva','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(10,'1010-23','Nathaniel Cruz Torres','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(11,'1011-23','Jasmine Rose Castillo','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(12,'1012-23','Kevin Angelo Aquino','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(13,'1013-23','Nicole Frances Ramos','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(14,'1014-23','John Michael Flores','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(15,'1015-23','Kyla Marie Gonzales','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(16,'1016-23','Christian Paul Rivera','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(17,'1017-23','Hannah Grace Fernandez','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(18,'1018-23','Adrian Luis Mercado','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(19,'1019-23','Patricia Anne Pascual','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(20,'1020-23','Ethan Gabriel Manalo','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(21,'1021-23','Camille Joy Santos','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(22,'1022-23','Matthew Ryan Reyes','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(23,'1023-23','Angela Mae Cruz','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(24,'1024-23','Jericho Daniel Garcia','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(25,'1025-23','Trisha Mae Mendoza','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(26,'1026-23','Luis Carlo Dela Cruz','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(27,'1027-23','Beatrice Anne Bautista','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(28,'1028-23','Rafael Miguel Navarro','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(29,'1029-23','Clarisse Joy Villanueva','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(30,'1030-23','Vincent Paul Torres','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(31,'1031-23','Katherine Mae Castillo','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(32,'1032-23','Joshua Daniel Aquino','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(33,'1033-23','Erika Louise Ramos','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(34,'1034-23','Nathan James Flores','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(35,'1035-23','Samantha Rose Gonzales','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(36,'1036-23','Miguel Angelo Rivera','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(37,'1037-23','Danielle Grace Fernandez','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(38,'1038-23','Paolo Luis Mercado','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(39,'1039-23','Christine Anne Pascual','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(40,'1040-23','Jacob Ryan Manalo','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(41,'1041-23','Isabelle Mae Santos','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(42,'1042-23','Francis Carlo Reyes','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(43,'1043-23','Maria Angelica Cruz','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(44,'1044-23','John Carlo Garcia','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(45,'1045-23','Rhea Marie Mendoza','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(46,'1046-23','Christian Miguel Dela Cruz','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(47,'1047-23','Ella Grace Bautista','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(48,'1048-23','Anthony Luis Navarro','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(49,'1049-23','Nicole Mae Villanueva','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(50,'1050-23','Gabriel John Torres','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(51,'1051-23','Sophia Claire Castillo','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(52,'1052-23','Marco Daniel Aquino','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(53,'1053-23','Janelle Rose Ramos','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(54,'1054-23','Andrew Miguel Flores','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(55,'1055-23','Bea Louise Gonzales','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(56,'1056-23','Carlo Vincent Rivera','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(57,'1057-23','Mikaela Anne Fernandez','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(58,'1058-23','Nathaniel James Mercado','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(59,'1059-23','Julia Mae Pascual','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(60,'1060-23','Enzo Gabriel Manalo','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(61,'1061-23','Katrina Joy Santos','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(62,'1062-23','Adrian Carlo Reyes','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(63,'1063-23','Faith Marie Cruz','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(64,'1064-23','Joshua Luis Garcia','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(65,'1065-23','Clarisse Anne Mendoza','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(66,'1066-23','Daniel Miguel Dela Cruz','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(67,'1067-23','Angelica Rose Bautista','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(68,'1068-23','Ryan Matthew Navarro','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(69,'1069-23','Chloe Mae Villanueva','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(70,'1070-23','Patrick James Torres','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(71,'1071-23','Vanessa Grace Castillo','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(72,'1072-23','Michael Angelo Aquino','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(73,'1073-23','Ariana Louise Ramos','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(74,'1074-23','Christian John Flores','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(75,'1075-23','Shane Marie Gonzales','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(76,'1076-23','Gabrielle Anne Rivera','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(77,'1077-23','Carlo Miguel Fernandez','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(78,'1078-23','Jessa Mae Mercado','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(79,'1079-23','Dominic Luis Pascual','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(80,'1080-23','Celine Rose Manalo','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(81,'1081-23','Mark Anthony Santos','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(82,'1082-23','Angela Joy Reyes','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(83,'1083-23','Renz Gabriel Cruz','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(84,'1084-23','Maria Louise Garcia','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(85,'1085-23','Jared Miguel Mendoza','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(86,'1086-23','Kristine Mae Dela Cruz','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(87,'1087-23','Paul Daniel Bautista','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(88,'1088-23','Sabrina Anne Navarro','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(89,'1089-23','Kenneth Luis Villanueva','BSIE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(90,'1090-23','Alyssa Grace Torres','BSCPE',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(91,'1091-23','Miguel James Castillo','BSHM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(92,'1092-23','Trina Mae Aquino','BSTM',11,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(93,'1093-23','Nathan Carlo Ramos','BSA',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(94,'1094-23','Jasmine Anne Flores','EDUC',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(95,'1095-23','Rafael Luis Gonzales','PTCP',12,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(96,'1096-23','Camille Rose Rivera','BSBA',13,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(97,'1097-23','Ethan Miguel Fernandez','BSCRIM',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(98,'1098-23','Bianca Mae Mercado','BSPSYCH',9,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(99,'1099-23','Joshua Carlo Pascual','BSIT',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08'),(100,'1100-23','Andrea Grace Manalo','BSCS',10,'Active','2026-09-24 14:56:08','2026-09-24 14:56:08');
/*!40000 ALTER TABLE `student_directory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `role` enum('admin','staff','security') NOT NULL DEFAULT 'staff',
  `position` varchar(50) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `security_code` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `users_username_unique` (`username`),
  KEY `users_security_code_role_status_index` (`security_code`,`role`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (3,'itm','$2y$12$6vmP6Meuc8VDXoFJvSUNluz57sTM0Ri3RAWhXKfOLnYltop8vdkDi','ITM Staff 1','staff','itm','active',NULL),(4,'admin','$2y$12$ZKgySpCN6E1hpOup977sZeDCZRP/nVcrkgHINt129YXkpuiDJUgOO','System Administrator','admin',NULL,'active',NULL),(5,'cashier1','$2y$12$LVMCfg6RPC7yKHhMvWxYr.lQBifd1c7jPBnHmifpEgwYfOm4jbuX6','Cashier Staff 1','staff','cashier','active',NULL),(6,'cashier2','$2y$12$ivcXgfncw92pmsWSPXh3S.9lsEh/RtlqAjkEmjPp4pYhAMrRAvMke','Cashier Staff 2','staff','cashier','active',NULL),(7,'cashier3','$2y$12$NcVzUA9gmMigdwUfx6KvTuHBQ2yjmZsbT0nF2VPZftNdBusH1KRTK','Cashier Staff 3','staff','cashier','active',NULL),(8,'registrar1','$2y$12$q32kdrZl7yaMlngVbYegGO2JJAVqfMwo2Tdu0vwm4vo1y1ySibZdC','Registrar Staff 1','staff','registrar','active',NULL),(9,'registrar2','$2y$12$Z4Hv8ETIWvbYMHbHJqZuieNZODtWhe1nF9W9.QGr13rWfX6B.8o8W','Registrar Staff 2','staff','registrar','active',NULL),(10,'registrar3','$2y$12$45ke6TQwgNKC3IHOwnFGdO5t73xYYrCsuFrzO0rRfo2LEcG.3.9ee','Registrar Staff 3','staff','registrar','active',NULL),(11,'registrar4','$2y$12$.cKRqmKwQwyP.q6FJ7zJ/OQmT5dtR.5pCo.UZGVobVDCofA93c61C','Registrar Staff 4','staff','registrar','active',NULL),(12,'registrar5','$2y$12$7psgdGgMD3/usoeVcgxcr.2wk2fRL3HlBaOe9oXraq36lLu97Fbxm','Registrar Staff 5','staff','registrar','active',NULL),(14,'security1','$2y$12$WTDDTDElBE30E47/IguUW.WHLK///yJ37.ApfuE1PKteE.CubloO6','Security Guard 1','security',NULL,'active','1234'),(15,'security2','$2y$12$dy.FvTXUP9/rWpQ6A1t4ReFUQ7Xwu8/2cLjamrcaPy5y9.ShLz7cu','Security Guard 2','security',NULL,'active','5678'),(16,'admission1','$2y$12$V2o9ydAguu3Z9RqSggl.Nu/DYgKZ0minFp8WR9GdH9AGkoon/tOlG','Admission Staff 1','staff','admission','active',NULL),(17,'itm2','$2y$12$5mgP0bsPEWvXE61HSXI5Oua.HDbiU911iV2Hq8dheaRhe8no9rJiG','ITM Staff 2','staff','itm','active',NULL),(18,'itm3','$2y$12$j1PNEJKKmoSV8mTUOO6gyONgj9uDogjRx6am9H3dVXDgbDWsuvVEa','ITM Staff 3','staff','itm','active',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'laravel'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-30 12:22:56
