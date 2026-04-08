// Include mongoose C library
#include "mongoose.h"
#include "json.hpp"
#include "backend.cpp"
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <cstdlib>
#include <map>

#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#include <limits.h>
#endif

using json = nlohmann::json;
using namespace MittiMart;

json db;

// Get the directory containing the running executable
std::string getExeDir() {
#ifdef _WIN32
    char buf[MAX_PATH];
    GetModuleFileNameA(NULL, buf, MAX_PATH);
    std::string path(buf);
    size_t pos = path.find_last_of("\\/");
    return (pos != std::string::npos) ? path.substr(0, pos) : ".";
#else
    char buf[PATH_MAX];
    ssize_t len = readlink("/proc/self/exe", buf, PATH_MAX - 1);
    if (len != -1) {
        buf[len] = '\0';
        std::string path(buf);
        size_t pos = path.find_last_of("\\/");
        return (pos != std::string::npos) ? path.substr(0, pos) : ".";
    }
    return ".";
#endif
}

std::string exeDir;
std::string publicDir;
std::string dbPath;

void saveDb() {
    std::ofstream ofs(dbPath);
    if (ofs.is_open()) {
        ofs << db.dump();
    }
}

void loadDb() {
    std::ifstream ifs(dbPath);
    if(ifs.good()){
        try {
            ifs >> db;
        } catch (...) {
            std::cerr << "MittiMart: Failed to parse database.json, initializing fresh." << std::endl;
        }
    }

    if(!db.contains("users"))         db["users"]         = json::array();
    if(!db.contains("products"))      db["products"]      = json::array();
    if(!db.contains("carts"))         db["carts"]         = json::object();
    if(!db.contains("wishlists"))     db["wishlists"]     = json::object();
    if(!db.contains("orders"))        db["orders"]        = json::array();
    if(!db.contains("nextOrderId"))   db["nextOrderId"]   = 1001;
    if(!db.contains("nextUserId"))    db["nextUserId"]    = 501;
    if(!db.contains("nextProductId")) db["nextProductId"] = 19;

    // Seed a clean, non-duplicate product catalog on first run
    if (db["products"].empty()) {
        db["products"] = json::array();

        // Each entry: name, category, unit, img, price, stock, rating, reviews
        struct P { std::string name, cat, unit, img; double price; int stock; double rating; int reviews; };
        std::vector<P> catalog = {
            // Dairy
            {"A2 Cow Milk",          "dairy",      "1 L",   "/images/mittimart_a2_milk_1774719413119.png",       75.0, 100, 4.9, 500},
            {"Paneer",               "dairy",      "200 g", "/images/mittimart_paneer_1774719431118.png",       120.0,  40, 4.8, 310},
            {"Curd",                 "dairy",      "500 g", "/images/mittimart_curd_1774719450813.png",          40.0, 100, 4.7, 290},
            {"Desi Ghee",            "dairy",      "500 ml","/images/user_desi_ghee.jpg",                       650.0,  20, 5.0, 850},
            // Rice
            {"Karuppu Kavuni Rice",  "rice",       "1 kg",  "/images/mittimart_black_rice_1774717842790.png",   180.0,  50, 4.9, 214},
            {"Mapillai Samba Rice",  "rice",       "1 kg",  "/images/mittimart_red_rice_1774717862093.png",     150.0,  80, 4.8, 156},
            // Oils
            {"Groundnut Oil",        "oils",       "1 L",   "/images/mittimart_groundnut_oil_1774717878748.png",320.0,  30, 4.9, 342},
            {"Sesame Oil",           "oils",       "1 L",   "/images/mittimart_sesame_oil_1774717895512.png",   450.0,  25, 4.9, 412},
            // Millets
            {"Ragi",                 "millets",    "1 kg",  "/images/mittimart_ragi_1774717916507.png",          80.0, 100, 4.7,  98},
            {"Kambu",                "millets",    "1 kg",  "/images/mittimart_pearl_millet_1774717937515.png",  70.0, 120, 4.6,  75},
            // Vegetables
            {"Tomatoes",             "vegetables", "1 kg",  "/images/mittimart_tomatoes_1774717972229.png",      60.0, 150, 4.5, 310},
            {"Drumstick",            "vegetables", "500 g", "/images/mittimart_drumsticks_1774717990482.png",    80.0,  80, 4.7, 145},
            {"Small Onions",         "vegetables", "1 kg",  "/images/mittimart_small_onions_1774718011186.png",  90.0, 200, 4.8, 405},
            // Fruits
            {"Mango",                "fruits",     "1 kg",  "/images/mittimart_mango_1774718027608.png",        160.0,  40, 5.0, 890},
            {"Red Banana",           "fruits",     "6 pcs", "/images/mittimart_red_banana_1774718046416.png",    80.0,  90, 4.6, 220},
            // Sweeteners
            {"Jaggery",              "sweeteners", "1 kg",  "/images/mittimart_jaggery_1774717954723.png",      110.0,  60, 4.8, 520},
            // Beverages
            {"Filter Coffee Powder", "beverages",  "1 kg",  "/images/mittimart_filter_coffee_1774718066731.png",600.0,  50, 4.9, 670},
            // Earthenware
            {"Clay Water Pot",       "earthenware","1 pc",  "/images/mittimart_clay_pot_1774718092274.png",     250.0,  20, 4.7, 315}
        };

        int nextId = 1;
        for (auto& s : catalog) {
            json p;
            p["id"]       = nextId++;
            p["sellerId"] = 101;
            p["name"]     = s.name;
            p["category"] = s.cat;
            p["price"]    = s.price;
            p["unit"]     = s.unit;
            p["stock"]    = s.stock;
            p["rating"]   = s.rating;
            p["reviews"]  = s.reviews;
            p["img"]      = s.img;
            db["products"].push_back(p);
        }
        db["nextProductId"] = nextId;
        saveDb();
        std::cout << "[MittiMart] Seeded " << catalog.size() << " clean products.\n";
    }
}

// Mongoose HTTP Event Handler
static void fn(struct mg_connection *c, int ev, void *ev_data) {
  if (ev == MG_EV_HTTP_MSG) {
    struct mg_http_message *hm = (struct mg_http_message *) ev_data;

    // Allow Preflight CORS
    if (mg_match(hm->method, mg_str("OPTIONS"), NULL)) {
        mg_http_reply(c, 200, "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n", "");
        return;
    }

    if (mg_match(hm->uri, mg_str("/api/db"), NULL)) {
      std::string dumped = db.dump();
      mg_printf(c, "HTTP/1.1 200 OK\r\n"
                   "Access-Control-Allow-Origin: *\r\n"
                   "Content-Type: application/json\r\n"
                   "Content-Length: %d\r\n\r\n"
                   "%s", (int)dumped.size(), dumped.c_str());

    } else if (mg_match(hm->uri, mg_str("/api/sync"), NULL)) {
      try {
        std::string body(hm->body.buf, hm->body.len);
        json incoming = json::parse(body);
        db = incoming;
        saveDb();

        std::string res = "{\"success\":true}";
        mg_printf(c, "HTTP/1.1 200 OK\r\n"
                     "Access-Control-Allow-Origin: *\r\n"
                     "Content-Type: application/json\r\n"
                     "Content-Length: %d\r\n\r\n"
                     "%s", (int)res.size(), res.c_str());
      } catch(...) {
        mg_http_reply(c, 400, "Access-Control-Allow-Origin: *\r\nContent-Type: application/json\r\n", "{\"error\":\"Invalid parsing\"}");
      }
    } else {
      // Serve index.html and static files from the public/ folder
      struct mg_http_serve_opts opts = {0};
      opts.root_dir = publicDir.c_str();
      mg_http_serve_dir(c, hm, &opts);
    }
  }
}

int main(void) {
  // Resolve absolute paths relative to where the exe lives
  exeDir    = getExeDir();
  publicDir = exeDir + "/public";
  dbPath    = exeDir + "/database.json";
  std::cout << "[MittiMart] Exe dir     : " << exeDir    << "\n";
  std::cout << "[MittiMart] Static files: " << publicDir << "\n";
  std::cout << "[MittiMart] Database    : " << dbPath    << "\n";
  loadDb();

  struct mg_mgr mgr;
  mg_mgr_init(&mgr);
  const char* port = "http://0.0.0.0:8080";
  if (mg_http_listen(&mgr, port, fn, NULL) == NULL) {
      std::cerr << "Failed to listen on port 8080\n";
      return 1;
  }

  std::cout << "MittiMart C++ Backend ALIVE on " << port << "\n";
  for (;;) mg_mgr_poll(&mgr, 500);

  mg_mgr_free(&mgr);
  return 0;
}
